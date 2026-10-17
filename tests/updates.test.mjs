import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {UpdateManager,RELEASE_API,releaseCandidate} from '../lib/updates.mjs';
import {createApp} from '../scripts/serve.mjs';
import {cleanFixture,fixture,artifact,release,waitFor} from './update-fixtures.mjs';

test('oferece somente uma Release estável mais recente, do repositório correto e com digest',async()=>{
  const data=await artifact(),valid=release(data);
  assert.equal(releaseCandidate(valid,'0.1.1').version,'0.1.2');
  assert.equal(releaseCandidate(valid,'0.1.2'),null);
  for(const mutate of [r=>r.draft=true,r=>r.prerelease=true,r=>r.tag_name='v0.1.3-beta',r=>r.assets[0].digest=null,r=>r.assets[0].browser_download_url='https://example.org/file.gz',r=>r.assets[0].size=100000000]) {
    const bad=structuredClone(valid);mutate(bad);assert.equal(releaseCandidate(bad,'0.1.1'),null);
  }
});
test('consulta usa ETag, persiste Mais tarde e respeita rate limit inclusive na consulta manual',async()=>{
  const root=await fixture(),data=await artifact();let manager,now=100000,calls=0;
  try {
    const request=async(url,options)=>{
      calls++;assert.equal(url,RELEASE_API);
      if(calls===1)return new Response(JSON.stringify(release(data)),{headers:{etag:'"release"'}});
      assert.equal(options.headers['If-None-Match'],'"release"');
      return calls===2?new Response(null,{status:304}):new Response(null,{status:429,headers:{'retry-after':'3600'}});
    };
    manager=await new UpdateManager(root,{autoCheck:false,now:()=>now,request}).init();
    await manager.check({manual:true});await manager.check({manual:true});assert.equal(calls,1);
    await manager.dismiss('0.1.2');manager.close();
    manager=await new UpdateManager(root,{autoCheck:false,now:()=>now,request}).init();
    assert.equal(manager.view().dismissedVersion,'0.1.2');
    now+=60001;await manager.check({manual:true});assert.equal(manager.view().available.version,'0.1.2');
    now+=60001;await manager.check({manual:true});now+=120000;await manager.check({manual:true});assert.equal(calls,3);assert.match(manager.view().checkError,/pausa/);
  }finally{manager?.close();await cleanFixture(root);}
});
test('ausência de Release não aparece como versão mais recente e falha de rede não bloqueia o app',async()=>{
  const root=await fixture();let manager,now=100000;
  try {
    manager=await new UpdateManager(root,{autoCheck:false,now:()=>now,request:async()=>new Response(null,{status:404})}).init();
    await manager.check({manual:true});assert.equal(manager.view().hasRelease,false);assert.equal(manager.view().available,null);
    manager.request=async()=>{throw new Error('offline');};now+=60001;
    await manager.check({manual:true});assert.match(manager.view().checkError,/continuar usando/);
  }finally{manager?.close();await cleanFixture(root);}
});
test('aguarda rascunhos de todas as janelas e salvamentos; permite cancelar antes do reinício',async()=>{
  const root=await fixture(),data=await artifact();let manager,restarts=0,saving=true;
  try {
    manager=await new UpdateManager(root,{managed:true,autoCheck:false,busy:()=>saving,onRestart:async()=>{restarts++;},request:async url=>url===RELEASE_API?new Response(JSON.stringify(release(data))):new Response(data.compressed)}).init();
    manager.heartbeat('window-with-draft-01',false);manager.heartbeat('window-installing-02',true);
    await manager.check({manual:true});await manager.start('0.1.2');await waitFor(()=>manager.phase==='waiting-work');
    assert.equal(restarts,0);saving=false;await manager.maybeRestart();assert.equal(manager.phase,'waiting-work');
    await manager.cancel();assert.equal(manager.phase,'idle');
    await manager.start('0.1.2');await waitFor(()=>manager.phase==='waiting-work');
    manager.heartbeat('window-with-draft-01',true);await manager.maybeRestart();await waitFor(()=>restarts===1);
    assert.equal(manager.phase,'restarting');
  }finally{manager?.close();await cleanFixture(root);}
});
test('janela suspensa com rascunho não é descartada por timeout e uma nova edição interrompe o reinício',async()=>{
  const root=await fixture();let manager,now=100000;
  try {
    manager=await new UpdateManager(root,{autoCheck:false,now:()=>now}).init();
    manager.heartbeat('window-with-draft-01',false);now+=60000;assert.equal(manager.busy(),true);
    manager.phase='restarting';manager.heartbeat('window-with-draft-01',false);assert.equal(manager.phase,'waiting-work');
  }finally{manager?.close();await cleanFixture(root);}
});
test('pacote corrompido preserva os arquivos da instalação',async()=>{
  const root=await fixture(),data=await artifact();let manager;
  try {
    manager=await new UpdateManager(root,{autoCheck:false,managed:true,onRestart:()=>assert.fail('Não pode reiniciar'),request:async url=>url===RELEASE_API?new Response(JSON.stringify(release(data))):new Response(Buffer.alloc(data.compressed.length))}).init();
    await manager.check({manual:true});await manager.start('0.1.2');await waitFor(()=>manager.phase==='error');
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).version,'0.1.1');
  }finally{manager?.close();await cleanFixture(root);}
});
test('API recusa origem externa, requisição sem cabeçalho e URL de pacote fornecida pelo navegador',async()=>{
  const root=await fixture();let app;
  try {
    app=await createApp({root,port:0,updateOptions:{autoCheck:false,request:async()=>new Response(null,{status:404})}});
    assert.equal((await fetch(app.url+'/api/updates',{headers:{Origin:'https://example.org'}})).status,403);
    for(const action of ['check','install','cancel','dismiss'])assert.equal((await fetch(app.url+'/api/updates/'+action,{method:'POST',body:'{}'})).status,403);
    const headers={'Content-Type':'application/json','X-Scratches-Update':'1'};
    assert.equal((await fetch(app.url+'/api/updates/install',{method:'POST',headers,body:JSON.stringify({version:'9.9.9',url:'http://localhost/file'})})).status,400);
    const checked=await fetch(app.url+'/api/updates/check',{method:'POST',headers,body:'{}'});assert.equal((await checked.json()).hasRelease,false);
    const local=await fetch(app.url+'/api/workspace');assert.equal((await local.json()).revision,1);
    const draft=await fetch(app.url+'/api/updates/heartbeat',{method:'POST',headers,body:JSON.stringify({clientId:'window-with-draft-01',safe:false})});assert.equal((await draft.json()).busy,true);
    assert.equal((await fetch(app.url)).status,200);
  }finally{await app?.close();await cleanFixture(root);}
});
