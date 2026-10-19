import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LyricsSync, lyricMatch, lyricRecord, lyricsApi} from '../lib/lyrics-sync.mjs';
import {WorkspaceStore} from '../app/server/store.ts';
import {emptyWorkspace} from '../app/src/domain/model.ts';
import {newTrack} from '../app/src/domain/library.ts';
const track = {...newTrack(), title:'Canção de teste', artists:[{id:'a',name:'Artista'}], album:'Disco',duration:180};
const record = {id:12,trackName:'Cancao de teste',artistName:'Artista',albumName:'Disco',duration:181,plainLyrics:'Texto original de teste\nOutra linha de teste',instrumental:false};
async function cleanup(root) {
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'scratches-lyrics-'));
  await fs.rm(root,{recursive:true,force:true});
}

test('associação exige título, artista, duração e edição compatíveis sem declarar equivalência por ISRC',()=>{
  assert.equal(lyricMatch(track,record),true);
  for(const patch of [{trackName:'Outra música'},{artistName:'Outro Artista'},{duration:184},{trackName:'Canção de teste (Ao Vivo)'},{id:-1}])assert.equal(lyricMatch(track,{...record,...patch}),false);
  assert.equal(lyricMatch({...track,title:'Canção de teste (feat. Convidado)'},record),true);
  assert.equal(lyricRecord(track,{...record,instrumental:true}).instrumental,true);
  assert.equal(lyricRecord(track,{...record,plainLyrics:null,syncedLyrics:'[00:12.00]Texto de teste'}).text,'Texto de teste');
  assert.equal(lyricRecord(track,{...record,plainLyrics:'x'.repeat(100001)}),null);
  assert.match(lyricRecord(track,record).source,/lrclib.net\/api\/get\/12$/);
});

test('429 respeita Retry-After antes da próxima consulta, sem depender de corpo JSON',async()=>{
  const waits=[];let calls=0;
  const sync=new LyricsSync('',null,{delay:500,wait:async ms=>waits.push(ms),fetchImpl:async()=>++calls===1?new Response('aguarde',{status:429,headers:{'retry-after':'2'}}):Response.json(record)});
  assert.equal((await sync.query('get?track_name=teste')).id,12);
  assert.deepEqual(waits,[500,2000,500]);
});

test('busca recusa candidatos ambíguos e usa assinatura quando a pesquisa não encontra candidatos',async()=>{
  const run=rows=>new LyricsSync('',null,{delay:0,wait:async()=>{},fetchImpl:async url=>url.includes('/api/get?')?new Response('',{status:404}):Response.json(rows)}).lookup(track);
  assert.equal((await run([record])).trackId,track.id);
  assert.equal(await run([record,{...record,id:13,plainLyrics:'Outro texto de teste'}]),null);
  const fallback=new LyricsSync('',null,{delay:0,wait:async()=>{},fetchImpl:async url=>Response.json(url.includes('/api/search?')?[{...record,duration:200}]:record)});
  assert.equal((await fallback.lookup(track)).trackId,track.id);
});

test('sincronização conserva letras e projetos, persiste origem e retoma sem repetir consultas',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scratches-lyrics-'));
  try{
    await fs.mkdir(path.join(root,'app/public/catalogo'),{recursive:true});
    const own={...track,id:'local:own'};
    await fs.writeFile(path.join(root,'app/public/catalogo/catalogo.json'),JSON.stringify({tracks:[track,own]}));
    const store=new WorkspaceStore(path.join(root,'workspace.json'));
    const local={trackId:own.id,text:'Texto pessoal de teste',revision:'own',source:'',importedAt:'',languages:[],themes:[],mood:''};
    await store.save({...emptyWorkspace(),lyrics:{[own.id]:local}});
    let calls=0;
    const options={delay:0,wait:async()=>{},fetchImpl:async()=>{calls++;return Response.json([record]);}};
    const sync=new LyricsSync(root,store,options);sync.start();await sync.job;
    const state=await store.read();
    assert.deepEqual(state.lyrics[own.id],local);
    assert.match(state.lyrics[track.id].revision,/^lrclib:12:/);
    assert.equal(sync.state.indexed,1);assert.equal(sync.state.existing,1);
    const cacheFile=path.join(root,'.scratches/lyrics-index.json');const cache=JSON.parse(await fs.readFile(cacheFile,'utf8'));
    cache[track.id].status='errors';await fs.writeFile(cacheFile,JSON.stringify(cache));
    const resumed=new LyricsSync(root,store,options);resumed.start();await resumed.job;
    assert.equal(calls,1);assert.equal(resumed.state.existing,2);
    assert.equal(resumed.state.errors,0);
    assert.ok((await fs.readdir(path.join(root,'.scratches'))).some(file=>file.startsWith('antes-letras-')));
  }finally{await cleanup(root);}
});

test('falha persistente não cria novas consultas ao reabrir dentro do intervalo de uma hora',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scratches-lyrics-'));
  try {
    await fs.mkdir(path.join(root,'app/public/catalogo'),{recursive:true});
    await fs.writeFile(path.join(root,'app/public/catalogo/catalogo.json'),JSON.stringify({tracks:[track]}));
    const store=new WorkspaceStore(path.join(root,'workspace.json'));let calls=0;
    const options={delay:0,wait:async()=>{},fetchImpl:async()=>{calls++;return new Response('',{status:503});}};
    const sync=new LyricsSync(root,store,options);sync.start();await sync.job;
    assert.equal(calls,6);assert.equal(sync.state.errors,1);
    const next=new LyricsSync(root,store,options);next.start();await next.job;
    assert.equal(calls,6);assert.equal(next.state.errors,1);
  }finally{await cleanup(root);}
});

test('API de sincronização recusa origem externa antes de iniciar qualquer consulta',async()=>{
  let started=false;const api=lyricsApi({start(){started=true;},state:{running:false}});
  const req={url:'/api/lyrics/sync',method:'POST',headers:{host:'127.0.0.1:5174',origin:'https://externo.example'},socket:{remoteAddress:'127.0.0.1'}};
  let status;await api(req,{writeHead(s){status=s;},end(){}},()=>assert.fail());
  assert.equal(status,403);assert.equal(started,false);
});

test('falha transitória é repetida uma vez ao final e a contagem passa de falha para indexada',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scratches-lyrics-'));
  try {
    await fs.mkdir(path.join(root,'app/public/catalogo'),{recursive:true});
    await fs.writeFile(path.join(root,'app/public/catalogo/catalogo.json'),JSON.stringify({tracks:[track]}));
    const store=new WorkspaceStore(path.join(root,'workspace.json'));let calls=0;
    const sync=new LyricsSync(root,store,{delay:0,wait:async()=>{},fetchImpl:async()=>++calls<=3?new Response('',{status:503}):Response.json([record])});
    sync.start();await sync.job;
    assert.equal(calls,4);assert.equal(sync.state.errors,0);assert.equal(sync.state.indexed,1);
    assert.equal(sync.state.processed,1);assert.equal(sync.state.retryProcessed,1);
    assert.ok((await store.read()).lyrics[track.id]);
  } finally {await cleanup(root);}
});
