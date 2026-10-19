import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, validateWorkspace} from './model.ts';
import type {Track} from './model.ts';
import {canDeleteGeneralTrack, deleteGeneralTrack, mergeCatalog, newTrack, saveTrack} from './library.ts';
import {collectMetadata} from './metadata.ts';
const empty = {tracks: [], artists: []};
const song = (patch: Partial<Track> = {}): Track => ({...newTrack(), title: 'Música', artists: [{id: 'artista', name: 'Artista'}], ...patch});

test('catálogo unificado ignora antigas seleções pessoais sem perder músicas', () => {
  const track = song({id: 'deezer:1'}); const manual = song();
  const state = {...emptyWorkspace(), tracks: {[manual.id]: manual}, personalTrackIds: []};
  assert.equal(mergeCatalog({tracks: [track], artists: []}, state).tracks.length, 2);
  validateWorkspace(JSON.parse(JSON.stringify(state)));
});

test('só cadastros manuais próprios podem ser excluídos do geral; referências e metadados reutilizáveis sobrevivem', () => {
  const own = song({genres: ['Blues']}); const external = song({id: 'deezer:2'});
  let state = saveTrack(saveTrack(emptyWorkspace(), empty, own), empty, external);
  assert.equal(canDeleteGeneralTrack(state, empty, own.id), true);
  assert.equal(canDeleteGeneralTrack(state, empty, external.id), false);
  assert.equal(canDeleteGeneralTrack(state, {tracks: [own], artists: []}, own.id), false);
  assert.throws(() => deleteGeneralTrack(state, empty, external.id), /manualmente/);
  state = deleteGeneralTrack(state, empty, own.id);
  assert.equal(mergeCatalog(empty, state).tracks.some(item => item.id === own.id), false);
  assert.deepEqual(state.metadata?.genres, ['Blues']);
});

test('Single rejeita segunda faixa inclusive com tipo alterado e permite editar sua única faixa', () => {
  const single = song({album: 'Single', albumId: 'local-album:single', releaseType: 'single'});
  const state = saveTrack(emptyWorkspace(), empty, single);
  for (const releaseType of ['single', 'album', null] as const) assert.throws(() => saveTrack(state, empty, {...single, id: 'local:second', releaseType}), /Single/);
  assert.equal(saveTrack(state, empty, {...single, title: 'Corrigida'}, single.id).tracks?.[single.id].title, 'Corrigida');
  const converted = saveTrack(state, empty, {...single, releaseType: 'album'}, single.id);
  assert.equal(Object.keys(saveTrack(converted, empty, {...single, id: 'local:second', releaseType: 'album'}).tracks!).length, 2);
});

test('EP permanece em sete faixas e 30 minutos; oitava faixa promove todo o lançamento e persiste', () => {
  let state = emptyWorkspace();
  for (let i = 0; i < 7; i++) state = saveTrack(state, empty, song({album: 'EP', albumId: 'local-album:ep', releaseType: 'ep', duration: i === 0 ? 1800 : 0}));
  assert.ok(Object.values(state.tracks!).every(track => track.releaseType === 'ep'));
  state = saveTrack(state, empty, song({album: 'EP', albumId: 'local-album:ep', duration: 0}));
  const restored = JSON.parse(JSON.stringify(state)); validateWorkspace(restored);
  assert.ok(Object.values(restored.tracks as Record<string, Track>).every(track => track.releaseType === 'album'));
  assert.equal(collectMetadata(empty, restored).albums[0].releaseType, 'album');
});

test('31º minuto promove EP mesmo com duas faixas e ao editar duração; homônimos ficam separados', () => {
  const first = song({album: 'EP', albumId: 'local-album:ep', releaseType: 'ep', duration: 1800});
  let state = saveTrack(emptyWorkspace(), empty, first);
  const second = song({album: 'EP', albumId: first.albumId, releaseType: 'ep', duration: 0});
  state = saveTrack(state, empty, second);
  const unrelated = song({album: 'EP', albumId: 'local-album:other', releaseType: 'ep'});
  state = saveTrack(state, empty, unrelated);
  state = saveTrack(state, empty, {...second, duration: 1}, second.id);
  assert.equal(state.tracks?.[first.id].releaseType, 'album');
  assert.equal(state.tracks?.[second.id].releaseType, 'album');
  assert.equal(state.tracks?.[unrelated.id].releaseType, 'ep');
});
