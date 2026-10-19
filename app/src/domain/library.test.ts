import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, validateTrack, validateWorkspace} from './model.ts';
import {applyFoundMetadata, mergeCatalog, newTrack, saveTrack} from './library.ts';
import {emptyFilters, matchesFilters} from './search.ts';
const base = {tracks: [], artists: []};
const song = () => ({...newTrack(), title: 'Faixa de teste', artists: [{id: 'artist:1', name: 'Artista'}]});

test('música manual e correções sobrevivem ao backup e alteram a pesquisa sem mudar sua identidade', () => {
  const track = song();
  const initial = {...emptyWorkspace(), projects: [{id: 'p', name: 'Projeto preservado', createdAt: 'hoje', updatedAt: 'hoje', fragments: []}]};
  const added = saveTrack(initial, base, track);
  const edited = saveTrack(added, base, {...track, title: 'Título corrigido', languages: ['Português'], bpm: 92}, track.id);
  const restored = JSON.parse(JSON.stringify(edited)); validateWorkspace(restored);
  assert.ok(restored.tracks);
  assert.equal(mergeCatalog(base, restored).tracks[0].title, 'Título corrigido');
  assert.equal(restored.tracks[track.id].id, track.id);
  assert.deepEqual(restored.projects, initial.projects);
  assert.equal(matchesFilters(restored.tracks[track.id], {...emptyFilters, language: ['Português']}, restored), true);
});
test('edição de uma música de catálogo mantém letras, trechos e artistas correspondentes', () => {
  const track = song(); const seeded = {tracks: [track], artists: [{id: 'artist:1', name: 'Artista', picture: '/catalogo/artist.jpg'}]};
  const workspace = {...emptyWorkspace(), lyrics: {[track.id]: {trackId: track.id, text: 'Trecho de teste', revision: 'r', source: '', importedAt: 'hoje', languages: [], themes: [], mood: ''}}};
  const edited = saveTrack(workspace, seeded, {...track, artists: [{id: 'artist:2', name: 'Artista corrigido'}]}, track.id);
  assert.deepEqual(edited.lyrics, workspace.lyrics);
  assert.equal(mergeCatalog(seeded, edited).artists.length, 1);
  assert.equal(mergeCatalog(seeded, edited).artists[0].name, 'Artista corrigido');
  assert.equal(mergeCatalog(seeded, edited).tracks.length, 1);
});
test('enriquecimento preserva o ID, referências e atributos não disponíveis na nova fonte', () => {
  const current = {...song(), bpm: 90, key: 0, mode: 'major', lyricsReferences: ['https://example.org/referencia']};
  const found = {...song(), id: 'deezer:42', title: 'Título na fonte', source: 'https://www.deezer.com/track/42'};
  const merged = applyFoundMetadata(current, found);
  assert.equal(merged.id, current.id); assert.equal(merged.bpm, 90); assert.equal(merged.key, 0);
  assert.deepEqual(merged.lyricsReferences, current.lyricsReferences);
});
test('recusa duplicação por ID e ISRC, mas permite gravações diferentes', () => {
  const first = {...song(), isrc: 'BRABC2600001'};
  const workspace = saveTrack(emptyWorkspace(), base, first);
  assert.throws(() => saveTrack(workspace, base, first), /já está/);
  assert.throws(() => saveTrack(workspace, base, {...first, id: 'deezer:42'}), /já está/);
  assert.equal(Object.keys(saveTrack(workspace, base, {...song(), isrc: 'BRABC2600002'}).tracks!).length, 2);
  assert.throws(() => saveTrack(workspace, base, first, 'outro-id'), /preservar/);
});
test('metadados inválidos, links executáveis e ausência de artista não entram no backup', () => {
  const track = song(); validateTrack(track);
  for (const patch of [{cover: 'javascript:alert(1)'}, {source: 'file:///etc/passwd'}, {bpm: NaN}, {key: 12}, {artists: []}, {releaseDate: '2026-02-31'}, {duration: -1}, {isrc: 'inventado'}]) {
    assert.throws(() => validateWorkspace({...emptyWorkspace(), tracks: {[track.id]: {...track, ...patch}}}));
  }
  validateWorkspace(emptyWorkspace()); // Backups anteriores sem tracks continuam válidos.
});
