import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {runApplication} from '../scripts/run.mjs';
import {prepareUpdate,readJSON} from '../lib/update-installer.mjs';
import {cleanFixture,fixture,artifact} from './update-fixtures.mjs';

const oldServer=`import fs from 'node:fs';
const marker=new URL('../.scratches/booted',import.meta.url);const again=fs.existsSync(marker);fs.writeFileSync(marker,'booted');
process.send?.({type:'ready',version:'0.1.1'});setTimeout(()=>process.exit(again?0:75),100);`;

test('launcher instala, inicia a nova versão e só confirma após o sinal de prontidão',async()=>{
  const root=await fixture('0.1.1',{server:oldServer});
  const data=await artifact('0.1.2',{server:`process.send?.({type:'ready',version:'0.1.2'});setTimeout(()=>process.exit(0),250);`});
  try {
    await prepareUpdate(root,data.compressed,data);
    assert.equal(await runApplication(root,{env:{...process.env,SCRATCHES_OPEN:'0'},readyTimeout:3000}),0);
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).version,'0.1.2');
    assert.equal((await readJSON(path.join(root,'.scratches/updates/journal.json'))).status,'committed');
    assert.equal(await fs.readFile(path.join(root,'app/dist/catalogo/catalogo.json'),'utf8'),'{"private":"personal catalog"}');
  }finally{await cleanFixture(root);}
});

test('nova versão que falha ao iniciar é substituída pelo backup e a versão antiga abre',async()=>{
  const root=await fixture('0.1.1',{server:oldServer});
  const data=await artifact('0.1.2',{server:'process.exit(1);'});
  try {
    const state=await fs.readFile(path.join(root,'dados/prototipo-02/workspace.json'));
    await prepareUpdate(root,data.compressed,data);
    assert.equal(await runApplication(root,{env:{...process.env,SCRATCHES_OPEN:'0'},readyTimeout:3000}),0);
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'package.json'))).version,'0.1.1');
    assert.equal((await readJSON(path.join(root,'.scratches/updates/journal.json'))).status,'rolled-back');
    assert.deepEqual(await fs.readFile(path.join(root,'dados/prototipo-02/workspace.json')),state);
  }finally{await cleanFixture(root);}
});
