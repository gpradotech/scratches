import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Catalog, Track} from './model.ts';
import {albumId, artistAlbums, albumSortFromParams, albumSortParams, findAlbum, sortAlbums, nextAlbumSort, filterAlbums, releaseFilterFromParams, releaseFilterParams} from './albums.ts';

const track: Track = {id: 'first', title: 'Faixa A', album: 'Mesmo álbum', artists: [{id: 'principal', name: 'Principal'}], duration: 120, cover: '/capa.jpg', catalogAlbum: 'Mesmo álbum', bpm: null, key: null, mode: null, genres: [], genreScope: 'album', releaseDate: null, source: null, sourceMatch: 'test', lyricsReferences: [], isrc: null};
test('álbum reúne participações e mantém separados álbuns homônimos de artistas diferentes', () => {
  const feat = {...track, id: 'second', duration: 90, artists: [...track.artists, {id: 'convidado', name: 'Convidado'}]};
  const homonym = {...track, id: 'third', artists: [{id: 'outro', name: 'Outro'}]};
  const catalog: Catalog = {tracks: [track, feat, homonym], artists: []};
  const album = findAlbum(catalog, albumId(track))!;
  assert.deepEqual(album.tracks.map(t => t.id), ['first', 'second']);
  assert.equal(album.duration, 210);
  assert.equal(album.artist.name, 'Principal');
  assert.deepEqual(findAlbum(catalog, albumId(homonym))?.tracks.map(t => t.id), ['third']);
  assert.equal(findAlbum(catalog, 'inexistente'), undefined);
});
test('identidade de álbum tolera caixa e Unicode equivalente e sobrevive à codificação de URL', () => {
  const title = 'Álbum / Lado B? #1';
  const original = {...track, album: title};
  assert.equal(albumId(original), albumId({...track, album: ' ' + title.toLocaleUpperCase('pt-BR').normalize('NFD') + ' '}));
  assert.equal(decodeURIComponent(encodeURIComponent(albumId(original))), albumId(original));
});
test('capa de single ou outra edição não é apresentada como capa do álbum agrupado', () => {
  const single = {...track, catalogAlbum: 'Single da faixa A'};
  assert.equal(findAlbum({tracks: [single], artists: []}, albumId(single))?.coverTrack, undefined);
  const correct = {...track, id: 'second'};
  assert.equal(findAlbum({tracks: [single, correct], artists: []}, albumId(single))?.coverTrack?.id, 'second');
});

test('discografia agrupa por álbum sem perder participações ou incluir músicas sem o artista convidado', () => {
  const guest = {id: 'convidado', name: 'Convidado'};
  const feat = {...track, id: 'feat', artists: [...track.artists, guest]};
  const own = {...track, id: 'solo', album: 'Disco do convidado', artists: [guest]};
  const catalog: Catalog = {tracks: [track, feat, own], artists: []};
  const albums = artistAlbums(catalog, guest.id);
  assert.equal(albums.length, 2);
  assert.deepEqual(albums.flatMap(album => album.tracks.map(item => item.id)).sort(), ['feat', 'solo']);
  assert.equal(albums[0].id, albumId(track));
  assert.equal(albums[0].artist.id, 'principal');
  assert.equal(albums[0].duration, feat.duration);
  assert.equal(artistAlbums(catalog, 'ausente').length, 0);
});

test('data de lançamento exige edição correspondente, data válida e fontes consistentes', () => {
  const dated = {...track, releaseDate: '2020-01-20'};
  const catalog: Catalog = {tracks: [dated], artists: []};
  assert.equal(findAlbum(catalog, albumId(dated))?.releaseDate, '2020-01-20');
  assert.equal(findAlbum({...catalog, tracks: [dated, {...dated, id: 'other', releaseDate: '2021-01-20'}]}, albumId(dated))?.releaseDate, null);
  for (const releaseDate of ['2020-02-30', 'invalid', null]) {
    assert.equal(findAlbum({...catalog, tracks: [{...dated, releaseDate}]}, albumId(dated))?.releaseDate, null);
  }
  assert.equal(findAlbum({...catalog, tracks: [{...dated, catalogAlbum: 'Outra edição'}]}, albumId(dated))?.releaseDate, null);
});

test('ordenação de álbuns usa datas confirmadas, conserva desconhecidos no final e não altera a origem', () => {
  const catalog: Catalog = {tracks: [
    {...track, id: 'b', album: 'Disco 10', catalogAlbum: 'Disco 10', releaseDate: '2020-01-01'},
    {...track, id: 'a', album: 'Disco 2', catalogAlbum: 'Disco 2', releaseDate: '2022-01-01'},
    {...track, id: 'c', album: 'Álbum sem data', catalogAlbum: 'Álbum sem data'},
  ], artists: []};
  const albums = artistAlbums(catalog, 'principal');
  const ids = albums.map(album => album.id);
  assert.deepEqual(sortAlbums(albums, 'recent').map(album => album.title), ['Disco 2', 'Disco 10', 'Álbum sem data']);
  assert.deepEqual(sortAlbums(albums, 'oldest').map(album => album.title), ['Disco 10', 'Disco 2', 'Álbum sem data']);
  assert.deepEqual(sortAlbums(albums, 'title-asc').map(album => album.title), ['Álbum sem data', 'Disco 2', 'Disco 10']);
  assert.deepEqual(sortAlbums(albums, 'title-desc').map(album => album.title), ['Disco 10', 'Disco 2', 'Álbum sem data']);
  assert.deepEqual(albums.map(album => album.id), ids);
});

test('ordenação dos álbuns reinicia sua página e preserva modo, filtro legado e ordenação das músicas', () => {
  const original = new URLSearchParams('visualizacao=lista&album=Mesmo+álbum&ordenar=bpm-desc&pagina=2&porPagina=25');
  const next = albumSortParams(original, 'title-asc');
  assert.equal(next.get('pagina'), null);
  assert.equal(next.get('visualizacao'), 'lista');
  assert.equal(next.get('album'), 'Mesmo álbum');
  assert.equal(next.get('ordenar'), 'bpm-desc');
  assert.equal(next.get('porPagina'), '25');
  assert.equal(albumSortFromParams(next), 'title-asc');
  assert.equal(albumSortFromParams(new URLSearchParams('ordenarAlbuns=invalid')), 'recent');
  assert.equal(albumSortParams(next, 'recent').has('ordenarAlbuns'), false);
  assert.equal(original.get('pagina'), '2');
});

test('controle de ordenação percorre as duas direções de data e depois as duas direções de título', () => {
  let sort = albumSortFromParams(new URLSearchParams());
  const states = [sort];
  for (let i = 0; i < 4; i++) {sort = nextAlbumSort(sort); states.push(sort);}
  assert.deepEqual(states, ['recent', 'oldest', 'title-asc', 'title-desc', 'recent']);
});

test('filtro de lançamentos agrupa singles e EPs e mantém tipos desconhecidos somente em Todas', () => {
  const tracks: Track[] = (['album', 'single', 'ep', 'compilation', null] as const).map((releaseType, i) => ({
    ...track, id: String(i), album: 'Disco ' + i, catalogAlbum: 'Disco ' + i, releaseType,
  }));
  const albums = artistAlbums({tracks, artists: []}, 'principal');
  assert.equal(filterAlbums(albums, 'all').length, 5);
  assert.deepEqual(filterAlbums(albums, 'album').map(album => album.releaseType), ['album']);
  assert.deepEqual(filterAlbums(albums, 'single-ep').map(album => album.releaseType), ['single', 'ep']);
  assert.deepEqual(filterAlbums(albums, 'compilation').map(album => album.releaseType), ['compilation']);
  assert.equal(filterAlbums(albums.slice(0, 1), 'compilation').length, 0);
  assert.equal(albums.length, 5);
});

test('tipo do lançamento exige edição correspondente e classificação consistente', () => {
  const album: Track = {...track, releaseType: 'album'};
  const find = (tracks: Track[]) => findAlbum({tracks, artists: []}, albumId(album));
  assert.equal(find([album])?.releaseType, 'album');
  assert.equal(find([album, {...album, id: 'other', releaseType: null}])?.releaseType, 'album');
  assert.equal(find([album, {...album, id: 'other', releaseType: 'single'}])?.releaseType, null);
  assert.equal(find([{...album, catalogAlbum: 'Single de outra edição'}])?.releaseType, null);
});

test('tipo e ordenação preservam um ao outro, modo e capacidade; só reiniciam a página', () => {
  const original = new URLSearchParams('visualizacao=lista&ordenarAlbuns=title-desc&pagina=3&porPagina=25');
  const next = releaseFilterParams(original, 'single-ep');
  assert.equal(next.get('pagina'), null);
  assert.equal(next.get('visualizacao'), 'lista');
  assert.equal(next.get('porPagina'), '25');
  assert.equal(albumSortFromParams(next), 'title-desc');
  assert.equal(releaseFilterFromParams(albumSortParams(next, 'oldest')), 'single-ep');
  assert.equal(releaseFilterFromParams(new URLSearchParams('tipoLancamento=invalid')), 'all');
  assert.equal(releaseFilterParams(next, 'all').has('tipoLancamento'), false);
  assert.equal(original.get('pagina'), '3');
});
