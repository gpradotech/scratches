import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createMusicClient, musicApi} from './music.ts';
import {validateTrack} from '../src/domain/model.ts';
const deezer = {id: 42, title: 'Faixa', artist: {id: 1, name: 'Artista'}, contributors: [{id: 1, name: 'Artista'}, {id: 2, name: 'Participação'}], album: {id: 8, title: 'Álbum', cover_medium: 'https://example.org/cover.jpg'}, duration: 201, bpm: 0, release_date: '2020-01-02', isrc: 'BRABC2000001', link: 'https://www.deezer.com/track/42', explicit_lyrics: false};
const apple = {kind: 'song', trackId: 9, trackName: 'Faixa', artistId: 3, artistName: 'Artista', collectionName: 'Álbum', trackTimeMillis: 201000, releaseDate: '2020-01-02T00:00:00Z', primaryGenreName: 'Hip-Hop/Rap', trackViewUrl: 'https://music.apple.com/br/album/faixa/9', artworkUrl100: 'https://example.org/promotional.jpg'};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers: {'content-type': 'application/json'}});
test('sugestões consultam artistas, excluem álbuns externos e conservam gêneros no cache', async () => {
  const calls: string[] = [];
  const client = createMusicClient((async (address: string | URL | Request) => {
    calls.push(String(address));
    return response({data: String(address).endsWith('/genre') ? [{id: 0, name: 'Todos'}, {id: 1, name: 'Rap'}] : String(address).includes('/artist?') ? [{id: 8, name: 'Artista'}] : [{id: 9, title: 'Álbum', artist: {id: 8, name: 'Artista'}}]});
  }) as typeof fetch);
  assert.equal((await client.suggest('artist', 'Art')).items[0].artist?.id, 'deezer-artist:8');
  const before = calls.length;
  assert.equal((await client.suggest('album', 'Álb')).items.length, 0);
  assert.equal(calls.length, before);
  assert.equal((await client.suggest('genre', '')).items.length, 1);
  assert.equal((await client.suggest('genre', 'ra')).items[0].label, 'Rap');
  assert.equal(calls.filter(c => c.endsWith('/genre')).length, 1);
});

test('gravadoras consultam MusicBrainz com identificação, texto escapado, cache e deduplicação', async () => {
  const calls: string[] = [];
  const client = createMusicClient((async (address: string | URL | Request, options: RequestInit) => {
    calls.push(String(address)); assert.match(String(new Headers(options.headers).get('User-Agent')), /github.com\/gpradotech\/scratches/);
    return response({labels: [{name: 'Sony Music', country: 'US'}, {name: 'Sony Music', country: 'BR'}, {name: 'Sony Classical', country: 'US'}]});
  }) as typeof fetch);
  assert.equal((await client.suggest('label', 'S')).items.length, 0);
  const items = (await client.suggest('label', 'Sony')).items;
  assert.equal(items.length, 2); assert.match(items[0].description!, /MusicBrainz/);
  assert.equal(new URL(calls[0]).searchParams.get('query'), 'label:Sony*');
  assert.deepEqual((await client.suggest('label', 'sony')).items, items); assert.equal(calls.length, 1);
});
test('consulta por texto só oferece candidatos; detalhes mantêm desconhecidos e consultam álbum', async () => {
  const calls: string[] = [];
  const client = createMusicClient((async (address: string | URL | Request) => {
    calls.push(String(address));
    return response(String(address).includes('/album/') ? {id: 8, genres: {data: [{name: 'Rap/Hip Hop'}]}, record_type: 'album', label: 'Gravadora'} : String(address).includes('/track/') ? deezer : {data: [deezer]});
  }) as typeof fetch);
  const search = await client.search('Faixa Artista'); assert.equal(search.items.length, 1); assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith('https://api.deezer.com/search?'));
  const {track} = await client.details('deezer', '42'); validateTrack(track);
  assert.equal(track.bpm, null); assert.equal(track.key, null); assert.equal(track.mode, null);
  assert.equal(track.artists.length, 2); assert.equal(track.genreScope, 'album');
  assert.deepEqual(track.genres, ['Rap/Hip Hop']); assert.equal(track.label, 'Gravadora');
});
test('falha e ausência no Deezer tentam Apple, sem incluir áudio ou assets promocionais', async () => {
  for (const fail of [false, true]) {
    const client = createMusicClient((async (address: string | URL | Request) => {
      if (String(address).includes('api.deezer.com')) {if (fail) throw new Error('offline'); return response({data: []});}
      return response({results: [apple]});
    }) as typeof fetch);
    const search = await client.search('Faixa'); assert.equal(search.provider, 'itunes'); assert.ok(search.notice);
    const {track} = await client.details('itunes', '9'); validateTrack(track);
    assert.equal(track.duration, 201); assert.equal(track.cover, null); assert.equal(track.bpm, null);
    assert.equal(track.links?.[0].label, 'Apple (iTunes)'); assert.equal(track.explicit, null);
    assert.equal('previewUrl' in track, false);
  }
});
test('detalhes parciais do álbum não impedem revisão; ID diferente não é aceito', async () => {
  const client = createMusicClient((async (address: string | URL | Request) => String(address).includes('/album/') ? response({}, 503) : response(deezer)) as typeof fetch);
  const result = await client.details('deezer', '42'); validateTrack(result.track); assert.ok(result.notice);
  await assert.rejects(client.details('deezer', '43'), /confirmar/);
  await assert.rejects(client.details('deezer', 'https://example.org'), /inválido/);
});
test('API local recusa origem externa, fonte arbitrária e métodos de gravação sem consultar fornecedores', async () => {
  let calls = 0;
  const api = musicApi(createMusicClient((async () => {calls++; return response({data: [deezer]});}) as typeof fetch));
  const server = http.createServer((req, res) => {void api(req, res, () => {res.writeHead(404); res.end();});});
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as {port: number}).port; const base = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(base + '/api/music/search?q=Faixa', {headers: {Origin: 'https://example.org'}})).status, 403);
    assert.equal((await fetch(base + '/api/music/search?q=Faixa&provider=unknown')).status, 400);
    assert.equal((await fetch(base + '/api/music/metadata?provider=deezer&id=../42')).status, 400);
    assert.equal((await fetch(base + '/api/music/search?q=Faixa', {method: 'POST'})).status, 405);
    assert.equal(calls, 0);
    assert.equal((await fetch(base + '/api/music/search?q=Faixa')).status, 200);
    assert.equal(calls, 1);
  } finally {await new Promise<void>(resolve => {server.close(() => resolve()); server.closeAllConnections();});}
});

test('detalhes conservam fotos dos artistas e incorporam imagens válidas para sobreviver ao CDN indisponível', async () => {
  const photo = 'https://cdn-images.dzcdn.net/images/artist/' + 'a'.repeat(32) + '/250x250-000000-80-0-0.jpg';
  const cover = photo.replace('/artist/', '/cover/');
  const jpeg = Buffer.from([255, 216, 255, 224, ...Array(30).fill(0)]);
  let images = 0;
  const client = createMusicClient((async (address: string | URL | Request) => {
    if (String(address).includes('dzcdn.net')) {images++; return new Response(jpeg, {headers: {'content-type': 'image/jpeg'}});}
    return response(String(address).includes('/album/') ? {id: 8, cover_big: cover} : {...deezer, contributors: [{id: 1, name: 'Artista', picture_medium: photo}]});
  }) as typeof fetch);
  const details = await client.details('deezer', '42'); validateTrack(details.track);
  assert.equal(details.artists[0].id, 'deezer-artist:1');
  assert.match(details.artists[0].picture!, /^data:image\/jpeg;base64,/);
  assert.match(details.track.cover!, /^data:image\/jpeg;base64,/);
  await client.details('deezer', '42'); assert.equal(images, 2);
});

test('imagem bloqueada, executável ou grande conserva endereço e não impede cadastro nem deixa falha permanente', async () => {
  const cover = 'https://cdn-images.dzcdn.net/images/cover/' + 'a'.repeat(32) + '/500x500-000000-80-0-0.jpg';
  for (const image of [() => new Response(null, {status: 403}), () => new Response('<svg/>', {headers: {'content-type': 'image/svg+xml'}}), () => new Response('invalid', {headers: {'content-type': 'image/jpeg'}}), () => new Response('x', {headers: {'content-type': 'image/jpeg', 'content-length': '512001'}})]) {
    let attempts = 0;
    const client = createMusicClient((async (address: string | URL | Request) => {
      if (String(address).includes('dzcdn.net')) {attempts++; return image();}
      return response(String(address).includes('/album/') ? {id: 8, cover_big: cover} : deezer);
    }) as typeof fetch);
    assert.equal((await client.details('deezer', '42')).track.cover, cover);
    await client.details('deezer', '42'); assert.equal(attempts, 2);
  }
});
