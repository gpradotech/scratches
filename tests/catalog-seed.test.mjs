import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readCatalog} from '../lib/catalog-seed.mjs';
test('catálogo inicial popula instalação e preserva registros locais sem regravar o arquivo',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scratches-seed-'));
  t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep+'scratches-seed-'));await fs.rm(root,{recursive:true,force:true});});
  await fs.mkdir(path.join(root,'lib/seed'),{recursive:true});
  await fs.writeFile(path.join(root,'lib/seed/catalog.json'),JSON.stringify({tracks:[{id:'a',title:'Fonte'},{id:'b',title:'Inicial'}],artists:[{id:'x',name:'Inicial'}]}));
  assert.equal((await readCatalog(root)).tracks.length,2);
  const folder=path.join(root,'app/public/catalogo');await fs.mkdir(folder,{recursive:true});
  const bytes=JSON.stringify({tracks:[{id:'a',title:'Local'},{id:'c',title:'Própria'}],artists:[{id:'x',name:'Local'}]});
  await fs.writeFile(path.join(folder,'catalogo.json'),bytes);
  const result=await readCatalog(root);assert.deepEqual(result.tracks.map(t=>t.title),['Local','Inicial','Própria']);assert.equal(result.artists[0].name,'Local');
  assert.equal(await fs.readFile(path.join(folder,'catalogo.json'),'utf8'),bytes);
});
