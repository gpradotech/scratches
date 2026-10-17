import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from './model.ts';
import type {Catalog, Lyric, Track} from './model.ts';
import {bpmInput, emptyFilters, filtersFromParams, filtersToParams, hasFieldFilters, hasFilters, searchAll} from './search.ts';
import type {Filters} from './search.ts';

const first: Track = {id: 'a', title: 'Teste A', artists: [{id: 'a', name: 'Artista A'}], album: 'A', duration: 100,
  cover: null, bpm: 88.5, key: 0, mode: 'major', genres: ['Rap'], genreScope: 'album', releaseDate: null,
  catalogAlbum: null, source: null, sourceMatch: 'test', lyricsReferences: [], isrc: null};
const second: Track = {...first, id: 'b', title: 'Teste B', artists: [{id: 'b', name: 'Artista B'}], bpm: 120, key: 2, mode: 'minor', genres: ['Pop']};
const third: Track = {...first, id: 'c', title: 'Teste C', bpm: null, key: null, mode: null, genres: []};
const catalog: Catalog = {tracks: [first, second, third], artists: []};
const local: Lyric = {trackId: 'a', text: 'Texto técnico de teste', revision: 'r1', source: '', importedAt: '', themes: [], mood: '', languages: ['Português', 'Inglês']};
const workspace = {...emptyWorkspace(), lyrics: {a: local, b: {...local, trackId: 'b', languages: ['Espanhol']}}};
const ids = (filters: Filters) => searchAll(catalog, 'teste', filters, workspace).tracks.map(track => track.id);

test('checkboxes são filtros ativos sem alterar o modo do cabeçalho ao marcar ou desmarcar', () => {
  assert.equal(hasFieldFilters(emptyFilters), false);
  for (const flags of [{hasAttributes: true}, {hasLyrics: true}, {hasAttributes: true, hasLyrics: true}]) {
    const filters = {...emptyFilters, ...flags};
    assert.equal(hasFilters(filters), true);
    assert.equal(hasFieldFilters(filters), false);
    assert.equal(hasFieldFilters({...filters, bpmMin: '80'}), true);
    assert.equal(hasFieldFilters({...filters, key: ['0']}), true);
    assert.equal(hasFieldFilters({...filters, theme: 'amor'}), true);
  }
});

test('selects múltiplos combinam opções por OU, e filtros diferentes se combinam por E', () => {
  const combined: Filters = {...emptyFilters, key: ['0', '2'], genre: ['Rap', 'Pop'], language: ['Inglês', 'Espanhol'], artist: ['Artista A', 'Artista B']};
  assert.deepEqual(ids(combined), ['a', 'b']);
  for (const key of ['key', 'genre', 'language'] as const) {
    assert.deepEqual(ids({...emptyFilters, [key]: combined[key]}), ['a', 'b']);
  }
  assert.deepEqual(ids({...combined, artist: ['Artista B', 'Ausente']}), ['b']);
  assert.deepEqual(ids({...combined, bpmMax: '100'}), ['a']);
  assert.deepEqual(ids({...combined, genre: ['Pop'], key: ['0']}), []);
  assert.deepEqual(searchAll(catalog, 'técnico', combined, workspace).passages.map(p => p.track.id), ['a', 'b']);
});

test('estado neutro inclui atributos ausentes e cada seleção exige correspondência no seu atributo', () => {
  const selected: Filters = {...emptyFilters, key: ['0', '2'], genre: ['Rap', 'Pop'], language: ['Inglês', 'Espanhol']};
  assert.deepEqual(ids(selected), ['a', 'b']);
  assert.deepEqual(ids(emptyFilters), ['a', 'b', 'c']);
  assert.equal(hasFilters(emptyFilters), false);
  assert.equal(hasFilters({...emptyFilters, key: ['0']}), true);
  assert.equal(hasFilters({...emptyFilters, hasAttributes: true}), true);
  assert.equal(hasFilters({...emptyFilters, hasLyrics: true}), true);
  assert.equal(hasFilters(filtersFromParams(filtersToParams(emptyFilters))), false);
});

test('URL preserva todas as seleções, a consulta, nomes com vírgula e links antigos de uma opção', () => {
  const filters: Filters = {...emptyFilters, key: ['0', '2'], mode: ['minor'], genre: ['Rap, Funk', 'Pop'], language: ['Português', 'Inglês'], artist: ['A', 'B'], bpmMin: '88.5', hasAttributes: true, hasLyrics: true};
  const params = filtersToParams(filters, new URLSearchParams('q=teste&modo=trechos&genre=antigo&unknown=1&pagina=3&visualizacao=galeria&ordenar=title-desc'));
  assert.deepEqual(params.getAll('genre'), ['Rap, Funk', 'Pop']);
  assert.equal(params.get('q'), 'teste'); assert.equal(params.has('modo'), false);
  assert.equal(params.has('unknown'), false); assert.equal(params.has('pagina'), false);
  assert.equal(params.get('visualizacao'), 'galeria'); assert.equal(params.get('ordenar'), 'title-desc');
  assert.deepEqual(filtersFromParams(new URLSearchParams(params.toString())), filters);
  const old = filtersFromParams(new URLSearchParams('key=0&genre=Rap&language=Português&artist=A&mode=major'));
  assert.deepEqual(old.key, ['0']); assert.deepEqual(old.language, ['Português']);
  assert.deepEqual(filtersFromParams(new URLSearchParams('genre=Rap&genre=Rap&genre=')).genre, ['Rap']);
});

test('Modo mantém uma escolha, filtra maior ou menor e volta ao neutro ao limpar', () => {
  assert.deepEqual(ids({...emptyFilters, mode: ['major']}), ['a']);
  assert.deepEqual(ids({...emptyFilters, mode: ['minor']}), ['b']);
  assert.deepEqual(ids({...emptyFilters, mode: []}), ['a', 'b', 'c']);
  const legacy = filtersFromParams(new URLSearchParams('mode=major&mode=minor&genre=Rap&genre=Pop'));
  assert.deepEqual(legacy.mode, ['minor']);
  assert.deepEqual(legacy.genre, ['Rap', 'Pop']);
  assert.deepEqual(filtersFromParams(new URLSearchParams('mode=minor&mode=major')).mode, ['major']);
  assert.deepEqual(filtersFromParams(new URLSearchParams('mode=major&mode=minor&mode=major')).mode, ['major']);
  assert.deepEqual(filtersFromParams(new URLSearchParams('mode=invalid')).mode, []);
  const params = filtersToParams({...emptyFilters, mode: ['major', 'minor']}, new URLSearchParams('q=teste'));
  assert.deepEqual(params.getAll('mode'), ['minor']);
  assert.equal(params.get('q'), 'teste');
  assert.equal(filtersToParams(emptyFilters, params).has('mode'), false);
});

test('checkboxes funcionam sozinhos, em conjunto e com os demais filtros na busca de músicas e trechos', () => {
  const mixed = {...emptyWorkspace(), lyrics: {a: local, c: {...local, trackId: 'c'}}};
  const tracks = (filters: Filters) => searchAll(catalog, 'teste', filters, mixed).tracks.map(track => track.id);
  assert.deepEqual(tracks(emptyFilters), ['a', 'b', 'c']);
  assert.deepEqual(tracks({...emptyFilters, hasAttributes: true}), ['a', 'b']);
  assert.deepEqual(tracks({...emptyFilters, hasLyrics: true}), ['a', 'c']);
  assert.deepEqual(tracks({...emptyFilters, hasAttributes: true, hasLyrics: true}), ['a']);
  assert.deepEqual(tracks({...emptyFilters, hasAttributes: true, hasLyrics: true, bpmMin: '100'}), []);
  assert.deepEqual(tracks({...emptyFilters, hasLyrics: true, genre: ['Rap']}), ['a']);
  const passages = (filters: Filters) => searchAll(catalog, 'técnico', filters, mixed).passages.map(p => p.track.id);
  assert.deepEqual(passages({...emptyFilters, hasLyrics: true}), ['a', 'c']);
  assert.deepEqual(passages({...emptyFilters, hasLyrics: true, hasAttributes: true}), ['a']);
});

test('BPM e tonalidade exigem os três dados e não exigem gênero ou atributos da letra', () => {
  const candidates: Track[] = [
    {...first, id: 'valid', key: 0, genres: []},
    {...first, id: 'no-bpm', bpm: null}, {...first, id: 'no-key', key: null}, {...first, id: 'no-mode', mode: null},
  ];
  const found = searchAll({tracks: candidates, artists: []}, '', {...emptyFilters, hasAttributes: true}, emptyWorkspace());
  assert.deepEqual(found.tracks.map(track => track.id), ['valid']);
});

test('letra disponível exige texto e não considera referência externa, texto vazio ou apenas espaços', () => {
  const tracks = [first, second, {...third, lyricsReferences: ['https://example.com/letra']}];
  const blank = {...emptyWorkspace(), lyrics: {a: {...local, text: ''}, b: {...local, trackId: 'b', text: ' \n '}}};
  assert.equal(searchAll({tracks, artists: []}, '', {...emptyFilters, hasLyrics: true}, blank).tracks.length, 0);
  assert.equal(searchAll({tracks, artists: []}, '', emptyFilters, blank).tracks.length, 3);
});

test('flags novas são neutras por padrão, sobrevivem à URL e limpar remove flags atuais e antigas', () => {
  const old = filtersFromParams(new URLSearchParams('unknown=1'));
  assert.deepEqual(old, emptyFilters);
  assert.equal(hasFilters(filtersFromParams(new URLSearchParams('hasAttributes=0&hasLyrics=no'))), false);
  const active = {...emptyFilters, hasAttributes: true, hasLyrics: true};
  const base = filtersToParams(active, new URLSearchParams('q=rap&unknown=1&pagina=3'));
  assert.deepEqual(filtersFromParams(new URLSearchParams(base.toString())), active);
  const cleared = filtersToParams(emptyFilters, base);
  assert.equal(cleared.get('q'), 'rap');
  for (const key of ['unknown', 'hasAttributes', 'hasLyrics', 'pagina']) assert.equal(cleared.has(key), false);
});

test('BPM aceita apenas números de 0 a 400 e decimais com vírgula ou ponto', () => {
  for (const [input, expected] of [['', ''], ['0', '0'], ['88,5', '88.5'], ['120.', '120.'], ['400', '400']]) assert.equal(bpmInput(input), expected);
  for (const input of ['abc', '88a', '1e2', '-1', '+80', '8 0', '88.5.2', '88,5,2', '401', 'Infinity']) assert.equal(bpmInput(input), null);
  const restored = filtersFromParams(new URLSearchParams('bpmMin=abc&bpmMax=88,5'));
  assert.equal(restored.bpmMin, ''); assert.equal(restored.bpmMax, '88.5');
});
