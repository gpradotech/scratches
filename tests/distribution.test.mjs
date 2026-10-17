import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {buildPackage,decodePackage} from '../lib/update-package.mjs';
import {cleanFixture,fixture} from './update-fixtures.mjs';

test('pacote real inicia sem node_modules, sem workspaces e sem catálogo pessoal',async()=>{
  const source=fileURLToPath(new URL('../',import.meta.url));
  const artifact=await buildPackage(source),root=await fixture('0.1.0',{dependency:null});let child;
  try {
    for(const file of decodePackage(artifact.compressed,artifact).files){const target=path.join(root,file.path);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.from(file.content,'base64'));}
    await fs.unlink(path.join(root,'node_modules/preserve.txt'));await fs.rmdir(path.join(root,'node_modules'));
    await fs.unlink(path.join(root,'prototipos/02-exploracao-local/dist/catalogo/catalogo.json'));await fs.rmdir(path.join(root,'prototipos/02-exploracao-local/dist/catalogo'));
    await assert.rejects(fs.access(path.join(root,'node_modules')));
    let output='';
    child=spawn(process.execPath,['--use-system-ca',path.join(root,'scripts/serve.mjs')],{cwd:root,windowsHide:true,env:{...process.env,SCRATCHES_PORT:'0',SCRATCHES_UPDATE_CHECKS:'0'},stdio:['ignore','pipe','pipe','ipc']});
    child.stdout.on('data',chunk=>{output+=chunk;});
    const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('A distribuição não iniciou.')),10000);child.once('error',reject);child.once('exit',code=>{clearTimeout(timer);reject(new Error('Servidor encerrou: '+code));});child.once('message',message=>{clearTimeout(timer);resolve(message);});});
    assert.equal(ready.type,'ready');assert.equal(ready.version,artifact.version);
    const url=output.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];assert.ok(url);
    assert.equal((await fetch(url)).status,200);
    assert.deepEqual(await(await fetch(url+'/catalogo/catalogo.json')).json(),{tracks:[],artists:[]});
    assert.equal((await(await fetch(url+'/api/updates')).json()).canInstall,false);
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).workspaces,undefined);
    assert.equal((await(await fetch(url+'/api/workspace')).json()).revision,1);
  }finally{
    if(child && child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.send({type:'shutdown'});await exited;}
    await cleanFixture(root);
  }
});
