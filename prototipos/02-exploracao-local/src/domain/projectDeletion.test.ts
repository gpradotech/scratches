import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, validateWorkspace} from './model.ts';
import type {Fragment, Project} from './model.ts';
import {deleteFromProject, rememberDeleteConfirmation, skipDeleteConfirmation} from './projectDeletion.ts';

const fragment = (id: string, start: number): Fragment => ({id, trackId: 'song', lyricRevision: 'r1', start, end: start + 1, text: id, startLine: 1, endLine: 1, savedAt: '2026-10-16'});
const project: Project = {id: 'p', name: 'Meu projeto', createdAt: '2026-10-16', updatedAt: '2026-10-16', fragments: [fragment('a', 0), fragment('b', 1), fragment('c', 2)]};
const workspace = () => ({...emptyWorkspace(), projects: [structuredClone(project)]});

test('desfazer restaura trecho na posição original, sem alterar os demais dados', () => {
  const before = workspace();
  const deletion = deleteFromProject(before, {kind: 'fragment', projectId: 'p', fragmentId: 'b'});
  assert.deepEqual(deletion.workspace.projects[0].fragments.map(item => item.id), ['a', 'c']);
  const restored = deletion.restore(deletion.workspace);
  assert.deepEqual(restored.projects[0].fragments, before.projects[0].fragments);
  assert.equal(before.projects[0].fragments.length, 3);
  validateWorkspace(restored);
});

test('desfazer conserva renomeação, novos trechos, letras e revisão posteriores', () => {
  const deletion = deleteFromProject(workspace(), {kind: 'fragment', projectId: 'p', fragmentId: 'b'});
  const latest = {...deletion.workspace, revision: 12, projects: [{...deletion.workspace.projects[0], name: 'Renomeado', fragments: [...deletion.workspace.projects[0].fragments, fragment('d', 3)]}]};
  const restored = deletion.restore(latest);
  assert.equal(restored.revision, 12);
  assert.equal(restored.lyrics, latest.lyrics);
  assert.equal(restored.projects[0].name, 'Renomeado');
  assert.deepEqual(restored.projects[0].fragments.map(item => item.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(deletion.restore(restored), restored);
});

test('desfazer não duplica seleção salva novamente com outro ID', () => {
  const deletion = deleteFromProject(workspace(), {kind: 'fragment', projectId: 'p', fragmentId: 'b'});
  const latest = {...deletion.workspace, projects: [{...project, fragments: [fragment('x', 1)]}]};
  assert.equal(deletion.restore(latest), latest);
});

test('desfazer não recria projeto ausente e remoção de alvo ausente falha explicitamente', () => {
  const deletion = deleteFromProject(workspace(), {kind: 'fragment', projectId: 'p', fragmentId: 'b'});
  assert.throws(() => deletion.restore(emptyWorkspace()), /Restaure o projeto/);
  assert.throws(() => deleteFromProject(emptyWorkspace(), {kind: 'project', projectId: 'p'}), /não está mais disponível/);
  assert.throws(() => deleteFromProject(workspace(), {kind: 'fragment', projectId: 'p', fragmentId: 'missing'}), /não está mais no projeto/);
});

test('desfazer mantém ordem quando os vizinhos também foram removidos', () => {
  const deletion = deleteFromProject(workspace(), {kind: 'fragment', projectId: 'p', fragmentId: 'b'});
  const latest = {...deletion.workspace, projects: [{...project, fragments: [fragment('a', 0), fragment('d', 3)]}]};
  assert.deepEqual(deletion.restore(latest).projects[0].fragments.map(item => item.id), ['a', 'b', 'd']);
});

test('restaurar projeto conserva o conteúdo completo e alterações em outros projetos', () => {
  const before = {...workspace(), projects: [project, {...project, id: 'other'}]};
  const deletion = deleteFromProject(before, {kind: 'project', projectId: 'p'});
  const latest = {...deletion.workspace, projects: [{...project, id: 'other', name: 'Outra alteração'}, {...project, id: 'new'}]};
  const restored = deletion.restore(latest);
  assert.deepEqual(restored.projects.map(item => item.id), ['p', 'other', 'new']);
  assert.deepEqual(restored.projects[0], project);
  assert.equal(restored.projects[1].name, 'Outra alteração');
  assert.deepEqual(deletion.restore(restored), restored);
  validateWorkspace(restored);
});

test('preferências de confirmação persistem separadamente para trechos e projetos', () => {
  const values = new Map<string, string>();
  const storage = {getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => {values.set(key, value);}};
  assert.equal(skipDeleteConfirmation(storage, 'fragment'), false);
  rememberDeleteConfirmation(storage, 'fragment');
  assert.equal(skipDeleteConfirmation(storage, 'fragment'), true);
  assert.equal(skipDeleteConfirmation(storage, 'project'), false);
  values.set('scratches:skip-delete-confirmation:project', 'false');
  assert.equal(skipDeleteConfirmation(storage, 'project'), false);
});

test('armazenamento bloqueado mantém confirmação e não impede a exclusão', () => {
  const storage = {getItem: (): string => {throw new Error('bloqueado');}, setItem: () => {throw new Error('bloqueado');}};
  assert.equal(skipDeleteConfirmation(storage, 'fragment'), false);
  assert.doesNotThrow(() => rememberDeleteConfirmation(storage, 'fragment'));
});
