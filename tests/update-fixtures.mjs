import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {buildPackage,sha256} from '../lib/update-package.mjs';

export async function cleanFixture(root) {
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'scratches-update-'));
  await fs.rm(root,{recursive:true,force:true});
}
export async function fixture(version='0.1.1',{server=`export const version=${JSON.stringify(version)};\n`,dependency='1'}={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scratches-update-'));
  const write=async(name,text)=>{const file=path.join(root,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);};
  const pkg={name:'scratches',version,engines:{node:'>=22.19.0'},dependencies:dependency?{example:dependency}:{}};
  const lock={name:'scratches',version,lockfileVersion:3,packages:{'':{name:'scratches',version,dependencies:pkg.dependencies}}};
  await write('package.json',JSON.stringify(pkg));await write('package-lock.json',JSON.stringify(lock));
  await write('scripts/serve.mjs',server);await write('scripts/run.mjs','// runner\n');await write('lib/update-installer.mjs','// installer\n');
  for(const name of ['server/api.ts','server/store.ts','src/domain/model.ts'])await write('app/'+name,'// runtime fixture\n');
  await write('app/dist/index.html','<div>Scratches '+version+'</div>');
  await write('app/dist/assets/app.js',`// ${version}\n`);
  await write('app/dist/catalogo/catalogo.json','{"private":"personal catalog"}');
  await write('dados/prototipo-02/workspace.json',JSON.stringify({schema:2,revision:1,projects:[],lyrics:{}}));
  await write('node_modules/preserve.txt','dependencies');
  await fs.mkdir(path.join(root,'.scratches'));
  return root;
}
export async function artifact(version='0.1.2',options) {
  const root=await fixture(version,options);
  try{return await buildPackage(root);}finally{await cleanFixture(root);}
}
export function release(data) {return {tag_name:'v'+data.version,draft:false,prerelease:false,body:'Melhorias de atualização.',assets:[{name:`scratches-${data.version}.update.json.gz`,state:'uploaded',digest:'sha256:'+data.digest,size:data.compressed.length,browser_download_url:`https://github.com/gpradotech/scratches/releases/download/v${data.version}/scratches-${data.version}.update.json.gz`}]};}
export function mutatedPackage(data,mutate) {mutate(data);const compressed=gzipSync(JSON.stringify(data));return {compressed,digest:sha256(compressed),version:data.version};}
export const waitFor=async condition=>{const deadline=Date.now()+7000;while(!condition()){if(Date.now()>deadline)throw new Error('Estado esperado não chegou');await new Promise(resolve=>setTimeout(resolve,10));}};
