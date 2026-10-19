import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

test('código público prepara catálogo vazio sem corpus privado e preserva catálogo existente', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scratches-catalog-'));
  try {
    const app = path.join(root, 'app');
    const script = path.join(app, 'scripts/preparar-catalogo.mjs');
    await fs.mkdir(path.dirname(script), {recursive: true});
    await fs.copyFile(new URL('../app/scripts/preparar-catalogo.mjs', import.meta.url), script);
    const run = () => execFileSync(process.execPath, [script], {cwd: root, windowsHide: true});
    run();
    const target = path.join(app, 'public/catalogo/catalogo.json');
    assert.deepEqual(JSON.parse(await fs.readFile(target)), {tracks: [], artists: []});
    const personal = JSON.stringify({tracks: [{id: 'personal'}], artists: []});
    await fs.writeFile(target, personal); run();
    assert.equal(await fs.readFile(target, 'utf8'), personal);
    // Ter material de pesquisa na máquina não deve repovoar a instalação do usuário.
    await fs.mkdir(path.join(root, 'dados/corpus-inicial-v1'), {recursive: true});
    await fs.writeFile(path.join(root, 'dados/corpus-inicial-v1/tracks.json'), '[{"id":"development"}]');
    await fs.writeFile(target, JSON.stringify({tracks: [], artists: []})); run();
    assert.deepEqual(JSON.parse(await fs.readFile(target)), {tracks: [], artists: []});
  } finally {
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), 'scratches-catalog-')));
    await fs.rm(root, {recursive: true, force: true});
  }
});
