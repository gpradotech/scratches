import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace, uploadedCover, validateWorkspace} from './model.ts';
import {mergeCatalog, newTrack, saveTrack} from './library.ts';
import {collectMetadata, createMetadataOption, mergeMetadataOptions, metadataOptions} from './metadata.ts';
import {albumId} from './albums.ts';
const empty = {tracks: [], artists: []};

test('apenas álbuns criados pelo usuário são oferecidos e não se misturam a álbuns externos homônimos', () => {
  const artist = createMetadataOption('artist', 'Artista').artist!;
  const own = createMetadataOption('album', 'Mesmo título', [artist]).album!;
  const external = {...own, id: 'deezer-album:42'};
  const track = {...newTrack(), title: 'Faixa', artists: [artist], album: own.title, albumId: own.id};
  const state = saveTrack(emptyWorkspace(), empty, track);
  const metadata = {...collectMetadata(empty, state), albums: [own, external]};
  assert.deepEqual(metadataOptions('album', metadata).map(o => o.value), [own.id]);
  assert.notEqual(albumId(track), albumId({...track, albumId: external.id}));
});
test('artista, álbum e demais metadados manuais conservam identidade e reaparecem após reabrir', () => {
  const artist = createMetadataOption('artist', 'Artista local').artist!;
  const album = createMetadataOption('album', 'Álbum local', [artist]).album!;
  const track = {...newTrack(), title: 'Primeira', artists: [artist], album: album.title, albumId: album.id, genres: ['Gênero próprio'], label: 'Selo próprio', languages: ['Português']};
  const state = saveTrack(emptyWorkspace(), empty, track);
  const reopened = JSON.parse(JSON.stringify(state)); validateWorkspace(reopened);
  const metadata = collectMetadata(empty, reopened);
  assert.equal(metadataOptions('artist', metadata)[0].value, artist.id);
  assert.equal(metadataOptions('album', metadata)[0].value, album.id);
  assert.deepEqual(metadata.genres, ['Gênero próprio']); assert.deepEqual(metadata.labels, ['Selo próprio']); assert.deepEqual(metadata.languages, ['Português']);
  const second = saveTrack(reopened, empty, {...track, id: 'local:second', title: 'Segunda'});
  assert.equal(second.metadata?.artists.length, 1); assert.equal(second.metadata?.albums.length, 1);
  const edited = saveTrack(second, empty, {...track, album: '', albumId: null, genres: [], label: null, languages: []}, track.id);
  assert.equal(edited.metadata?.albums[0].id, album.id); assert.deepEqual(edited.metadata?.genres, ['Gênero próprio']);
});

test('retratos escolhidos nas sugestões continuam nas opções locais e no catálogo após reabrir', () => {
  const artist = {...createMetadataOption('artist', 'Artista').artist!, picture: 'https://example.org/artist.jpg'};
  const track = {...newTrack(), title: 'Faixa', artists: [{id: artist.id, name: artist.name}]};
  const state = saveTrack(emptyWorkspace(), empty, track, undefined, [artist]);
  const reopened = JSON.parse(JSON.stringify(state)); validateWorkspace(reopened);
  const catalog = mergeCatalog(empty, reopened);
  assert.equal(catalog.artists[0].picture, artist.picture);
  const staleCatalog = {...catalog, artists: catalog.artists.map(a => ({...a, picture: null}))};
  assert.equal(metadataOptions('artist', collectMetadata(staleCatalog, reopened))[0].artist?.picture, artist.picture);
  assert.equal(saveTrack(reopened, staleCatalog, track, track.id).metadata?.artists[0].picture, artist.picture);
});
test('capas enviadas entram no backup e conteúdo executável é recusado', () => {
  const image = 'data:image/png;base64,' + btoa('\x89PNG\r\n\x1a\n' + '\0'.repeat(24));
  assert.equal(uploadedCover(image), true);
  const artist = createMetadataOption('artist', 'Artista').artist!;
  const state = saveTrack(emptyWorkspace(), empty, {...newTrack(), title: 'Faixa', artists: [artist], album: 'Disco', cover: image});
  validateWorkspace(JSON.parse(JSON.stringify(state)));
  const withPortrait = {...state, metadata: {...state.metadata!, artists: state.metadata!.artists.map(artist => ({...artist, picture: image}))}};
  validateWorkspace(JSON.parse(JSON.stringify(withPortrait)));
  assert.equal(mergeCatalog(empty, withPortrait).artists[0].picture, image);
  assert.equal(collectMetadata(empty, state).albums[0].cover, image);
  for (const invalid of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html;base64,PGgxPg==', 'data:image/png;base64,YWJj', 'data:image/png;base64,' + 'A'.repeat(750000)]) {
    assert.equal(uploadedCover(invalid), false);
    assert.throws(() => validateWorkspace({...withPortrait, metadata: {...withPortrait.metadata, artists: withPortrait.metadata.artists.map(artist => ({...artist, picture: invalid}))}}));
  }
});

test('gêneros e gravadoras unem nomes equivalentes de fontes diferentes; artistas e álbuns permitem homônimos', () => {
  const local = [{value: 'local', label: 'Blues'}]; const remote = [{value: 'deezer:42', label: 'BLÚES'}];
  for (const kind of ['genre', 'label'] as const) assert.deepEqual(mergeMetadataOptions(local, remote, kind), local);
  for (const kind of ['artist', 'album'] as const) assert.equal(mergeMetadataOptions(local, remote, kind).length, 2);
});
