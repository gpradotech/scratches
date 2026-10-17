import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WorkspaceStore, Conflict} from './store.ts';
import {emptyWorkspace, lyricLanguages} from '../src/domain/model.ts';
async function cleanup(dir: string) {
  assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep + 'scratches-store-'));
  await fs.rm(dir, {recursive: true, force: true});
}

test('idiomas múltiplos e idioma legado sobrevivem à gravação e reabertura', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scratches-store-'));
  try {
    const file = path.join(dir, 'workspace.json');
    const content = {text: 'Texto técnico de teste', revision: 'test-revision', source: 'Teste automatizado', importedAt: new Date().toISOString(), themes: [], mood: ''};
    await new WorkspaceStore(file).save({...emptyWorkspace(), lyrics: {
      multi: {...content, trackId: 'multi', languages: ['Português', 'Inglês']},
      legacy: {...content, trackId: 'legacy', language: 'Português'},
    }});
    const reopened = await new WorkspaceStore(file).read();
    assert.deepEqual(lyricLanguages(reopened.lyrics.multi), ['Português', 'Inglês']);
    assert.deepEqual(lyricLanguages(reopened.lyrics.legacy), ['Português']);
  } finally {await cleanup(dir);}
});
test('gravação local sobrevive a outra instância e recusa revisão antiga', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scratches-store-'));
  try {
    const file = path.join(dir, 'workspace.json'); const store = new WorkspaceStore(file); const initial = await store.read();
    const saved = await store.save(initial); assert.equal(saved.revision, 1);
    const reopened = await new WorkspaceStore(file).read(); assert.deepEqual(reopened, saved);
    await assert.rejects(store.save(initial), Conflict);
    assert.deepEqual(await store.read(), saved);
  } finally {await cleanup(dir);}
});
test('requisições concorrentes não sobrescrevem a mesma revisão', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scratches-store-'));
  try {
    const store = new WorkspaceStore(path.join(dir, 'workspace.json')); const initial = await store.read();
    const results = await Promise.allSettled([store.save(initial), store.save(initial)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  } finally {await cleanup(dir);}
});
test('arquivo inválido é preservado em vez de reinicializado', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scratches-store-'));
  try {
    const file = path.join(dir, 'workspace.json'); await fs.writeFile(file, 'arquivo corrompido');
    await assert.rejects(new WorkspaceStore(file).read()); assert.equal(await fs.readFile(file, 'utf8'), 'arquivo corrompido');
  } finally {await cleanup(dir);}
});
