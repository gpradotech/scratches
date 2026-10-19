import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';
import {buildPackage,decodePackage} from '../lib/update-package.mjs';
import {cleanFixture,fixture,waitFor} from './update-fixtures.mjs';

test('pacote real inicia com catálogo público, sem node_modules, workspaces ou dados pessoais',async()=>{
  const source=fileURLToPath(new URL('../',import.meta.url));
  const artifact=await buildPackage(source),root=await fixture('0.1.0',{dependency:null});let child;
  try {
    for(const file of decodePackage(artifact.compressed,artifact).files){const target=path.join(root,file.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(file.content,'base64'));}
    await fs.unlink(path.join(root,'node_modules/preserve.txt'));await fs.rmdir(path.join(root,'node_modules'));
    await fs.unlink(path.join(root,'app/dist/catalogo/catalogo.json'));await fs.rmdir(path.join(root,'app/dist/catalogo'));
    await assert.rejects(fs.access(path.join(root,'node_modules')));
    let output='';
    child=spawn(process.execPath,['--use-system-ca',path.join(root,'scripts/serve.mjs')],{cwd:root,windowsHide:true,env:{...process.env,SCRATCHES_PORT:'0',SCRATCHES_UPDATE_CHECKS:'0'},stdio:['ignore','pipe','pipe','ipc']});
    child.stdout.on('data',chunk=>{output+=chunk;});
    const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('A distribuição não iniciou.')),10000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Servidor encerrou: '+code));});child.once('message',message=>{clearTimeout(timer);resolve(message);});});
    assert.equal(ready.type,'ready');assert.equal(ready.version,artifact.version);
    const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url);
    assert.equal((await fetch(url)).status,200);
    assert.equal((await fetch(url+'/api/music/search?q=teste&provider=invalido')).status,400);
    const publicCatalog=JSON.parse(await fs.readFile(path.join(source,'lib/seed/catalog.json'),'utf8'));
    assert.deepEqual(await(await fetch(url+'/catalogo/catalogo.json')).json(),publicCatalog);
    assert.equal(publicCatalog.tracks.length,951);
    assert.equal((await(await fetch(url+'/api/updates')).json()).canInstall,false);
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).workspaces,undefined);
    assert.equal((await(await fetch(url+'/api/workspace')).json()).revision,1);
  }finally{
    if(child && child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});await exited;}
    await cleanFixture(root);
  }
});

test('inicializador real abre, reutiliza a instalação e encerra o servidor sem deixar a porta ocupada',async()=>{
  const source=fileURLToPath(new URL('../',import.meta.url));
  const artifact=await buildPackage(source),root=await fixture('0.1.0',{dependency:null});let child;
  const socket=net.createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const env={...process.env,SCRATCHES_PORT:String(port),SCRATCHES_UPDATE_CHECKS:'0',SCRATCHES_OPEN:'0'};
  try {
    for(const file of decodePackage(artifact.compressed,artifact).files){const target=path.join(root,file.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(file.content,'base64'));}
    const before=await fs.readFile(path.join(root,'dados/prototipo-02/workspace.json'));
    let output='';
    child=spawn(process.execPath,['--use-system-ca',path.join(root,'scripts/open-app.mjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
    child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});
    await waitFor(()=>output.includes('Scratches pronto.'));
    const second=await promisify(execFile)(process.execPath,['--use-system-ca',path.join(root,'scripts/open-app.mjs')],{cwd:root,env,windowsHide:true,timeout:10000});
    assert.match(second.stdout,/já está aberto/);assert.equal((await fetch(`http://127.0.0.1:${port}`)).status,200);
    const exited=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});
    assert.equal(await exited,0);
    await assert.rejects(fetch(`http://127.0.0.1:${port}`,{signal:AbortSignal.timeout(1500)}));
    assert.deepEqual(await fs.readFile(path.join(root,'dados/prototipo-02/workspace.json')),before);
  }finally{
    if(child && child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});await exited;}
    await cleanFixture(root);
  }
});
