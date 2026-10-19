import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, validateTrack, validateWorkspace} from './model.ts';
import type {Track} from './model.ts';
import {applyFoundMetadata, mergeCatalog, newTrack, saveTrack} from './library.ts';
import {completeMetadata, isImportedField, markImportedMetadata, metadataOrigin} from './metadataOrigins.ts';

const imported: Track = {...newTrack(), id: 'deezer:42', title: 'Título da fonte', artists: [{id: 'deezer-artist:1', name: 'Artista'}], album: 'Disco', albumId: 'deezer-album:8', catalogAlbum: 'Disco', duration: 210, key: 0, mode: 'major', explicit: false, genres: ['Rap'], genreScope: 'album', releaseDate: '2026-10-18', releaseType: 'album', isrc: 'BRABC2600001', source: 'https://www.deezer.com/track/42', sourceMatch: 'provider_catalog', links: [{label: 'Deezer', url: 'https://www.deezer.com/track/42'}]};
const catalog = {tracks: [imported], artists: []};

test('dados importados legados ficam protegidos, incluindo tom zero e explícito falso', () => {
  assert.equal(isImportedField(imported, 'key'), true);
  assert.equal(isImportedField(imported, 'explicit'), true);
  assert.equal(isImportedField(imported, 'bpm'), false);
  for (const patch of [{title: 'Outro'}, {artists: [{id: 'outro', name: 'Outro'}]}, {album: 'Outro'}, {duration: 200}, {key: 1}, {mode: 'minor'}, {explicit: true}, {genres: ['Pop']}, {source: null}, {releaseType: 'single' as const}, {isrc: null}, {metadataOrigins: {title: 'manual' as const}, title: 'Outro'}]) {
    assert.throws(() => saveTrack(emptyWorkspace(), catalog, {...imported, ...patch}, imported.id), /importad/);
  }
  for (const patch of [{albumId: 'local-album:outro'}, {genreScope: 'track'}, {sourceMatch: 'manual'}, {links: []}]) assert.throws(() => completeMetadata(imported, {...imported, ...patch}), /preservad/);
  assert.throws(() => applyFoundMetadata(imported, {...imported, title: 'Outro'}), /protegidos/);
});

test('complementos manuais preservam fonte, sobrevivem ao backup e podem ser corrigidos ou limpos', () => {
  const initial = {...emptyWorkspace(), projects: [], lyrics: {}};
  const saved = saveTrack(initial, catalog, {...imported, bpm: 90, languages: ['Português'], label: 'Selo local'}, imported.id);
  const reopened = JSON.parse(JSON.stringify(saved)); validateWorkspace(reopened);
  const track = mergeCatalog(catalog, reopened).tracks[0];
  assert.equal(track.metadataOrigins?.title, 'imported');
  for (const field of ['bpm', 'languages', 'label'] as const) assert.equal(track.metadataOrigins?.[field], 'manual');
  assert.equal(track.source, imported.source); assert.equal(track.sourceMatch, imported.sourceMatch);
  assert.deepEqual(saved.lyrics, initial.lyrics);
  const corrected = saveTrack(reopened, catalog, {...track, bpm: 92, languages: []}, track.id).tracks![track.id];
  assert.equal(corrected.bpm, 92); assert.equal(metadataOrigin(corrected, 'bpm'), 'manual');
  assert.equal(metadataOrigin(corrected, 'languages'), undefined);
  assert.throws(() => saveTrack(reopened, catalog, {...track, duration: 999}, track.id), /importad/);
});

test('nova importação protege valores antes do primeiro cadastro e registra apenas complementos como manuais', () => {
  const draft = markImportedMetadata({...imported, sourceMatch: 'selected_by_user'});
  assert.throws(() => completeMetadata(draft, {...draft, title: 'Outra versão'}), /importad/);
  const ready = completeMetadata(draft, {...draft, bpm: 95});
  const saved = saveTrack(emptyWorkspace(), {tracks: [], artists: []}, ready).tracks![draft.id];
  assert.equal(saved.metadataOrigins?.bpm, 'manual'); assert.equal(saved.metadataOrigins?.duration, 'imported');
  validateTrack(saved);
});

test('complementar uma faixa não altera dados de outras faixas do álbum importado', () => {
  const ep = {...imported, releaseType: 'ep' as const};
  const others = Array.from({length: 8}, (_, i) => ({...ep, id: 'deezer:' + (i + 100), isrc: null}));
  const saved = saveTrack(emptyWorkspace(), {tracks: [ep, ...others], artists: []}, {...ep, bpm: 90}, ep.id);
  assert.equal(saved.tracks![ep.id].releaseType, 'ep');
  assert.equal(Object.keys(saved.tracks!).length, 1);
});

test('origens inválidas são recusadas e cadastros manuais continuam editáveis', () => {
  for (const metadataOrigins of [{bpm: 'deezer'}, {unknown: 'manual'}, []]) assert.throws(() => validateTrack({...imported, metadataOrigins}), /Origem/);
  const manual = {...newTrack(), title: 'Manual', artists: imported.artists, source: 'https://example.org/referencia'};
  const base = {tracks: [], artists: []}; const saved = saveTrack(emptyWorkspace(), base, manual);
  assert.equal(saveTrack(saved, base, {...manual, title: 'Corrigido'}, manual.id).tracks![manual.id].title, 'Corrigido');
});
