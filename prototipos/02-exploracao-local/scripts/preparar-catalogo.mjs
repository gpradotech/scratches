import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(dir, '../..');
const out = path.join(dir, 'public/catalogo');
await fs.mkdir(out, {recursive: true});
const read = async p => JSON.parse(await fs.readFile(path.join(root, p), 'utf8'));
const source = await read('dados/corpus-inicial-v1/tracks.json').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return null;
});
if (source === null) {
  // Uma cópia pública não depende do corpus privado de desenvolvimento.
  // Se já existir um catálogo nesta instalação, preserve seu conteúdo.
  const target = path.join(out, 'catalogo.json');
  await fs.writeFile(target, JSON.stringify({tracks: [], artists: []}) + '\n', {flag: 'wx'})
    .catch(error => {if (error.code !== 'EEXIST') throw error;});
  console.log('Sem corpus de desenvolvimento: catálogo local preservado ou iniciado vazio.');
  process.exit(0);
}
const releaseTypes = await read('dados/corpus-inicial-v1/release-types.json').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return [];
});
const releaseTypeFor = (id, title) => {
  const release = releaseTypes.find(item => String(item.id) === String(id) && item.title.normalize('NFC').trim().toLocaleLowerCase('pt-BR') === title?.normalize('NFC').trim().toLocaleLowerCase('pt-BR'));
  return ['album', 'single', 'ep', 'compilation'].includes(release?.record_type) ? release.record_type : null;
};
const references = 'planejamento/prototipos/08-exploracao-musicas-artistas/referencias/';
const djonga = await read(references + 'catalogo.json');
const artists = new Map();
const normalize = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function addArtist(name, picture = null) {
  const id = normalize(name);
  if (!artists.has(id)) artists.set(id, {id, name, picture});
  else if (picture) artists.get(id).picture = picture;
  return id;
}
const tracks = [];
const copied = new Set();
for (const t of source) {
  let cover = null;
  if (t.artwork) {
    const file = path.basename(t.artwork.path);
    if (!copied.has(file)) {
      await fs.copyFile(path.join(root, 'dados/corpus-inicial-v1', t.artwork.path), path.join(out, file));
      copied.add(file);
    }
    cover = '/catalogo/' + file;
  }
  tracks.push({id: t.id, title: t.title, artists: t.artists.map(name => ({id: addArtist(name), name})), album: t.album,
    duration: t.duration_seconds, cover, bpm: t.audio_features?.bpm ?? null, key: t.audio_features?.key_pitch_class ?? null,
    mode: t.audio_features?.mode ?? null, genres: t.catalog?.album_genres ?? [], genreScope: 'album',
    releaseDate: t.catalog?.release_date ?? null, catalogAlbum: t.catalog?.album ?? null,
    releaseType: ['album', 'single', 'ep', 'compilation'].includes(t.catalog?.record_type) ? t.catalog.record_type : releaseTypeFor(t.catalog?.album_id, t.catalog?.album),
    source: t.catalog?.source_url ?? null, sourceMatch: t.catalog?.match ?? 'unavailable',
    lyricsReferences: t.lyrics.references.map(r => r.url), isrc: t.catalog?.isrc ?? null});
}
await Promise.all([
  fs.copyFile(path.join(root, references, 'heresia-capa.jpg'), path.join(out, 'heresia.jpg')),
  fs.copyFile(path.join(root, references, 'djonga-retrato.jpg'), path.join(out, 'djonga.jpg')),
]);
addArtist('Djonga', '/catalogo/djonga.jpg');
for (const t of djonga.body.data) tracks.push({id: 'deezer:' + t.id, title: t.title,
  artists: [{id: addArtist('Djonga'), name: 'Djonga'}], album: t.album.title, duration: t.duration,
  cover: '/catalogo/heresia.jpg', bpm: null, key: null, mode: null, genres: [], genreScope: 'album',
  releaseDate: null, catalogAlbum: t.album.title, releaseType: releaseTypeFor(t.album.id, t.album.title), source: 'https://api.deezer.com/track/' + t.id,
  sourceMatch: 'catalog_reference', lyricsReferences: [], isrc: null});
const portraits = await read('dados/corpus-inicial-v1/artists.json').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return [];
});
for (const portrait of portraits) {
  const artist = artists.get(normalize(portrait.name));
  if (!artist || artist.name !== portrait.name) continue;
  const filename = 'artist-' + path.basename(portrait.path);
  await fs.copyFile(path.join(root, 'dados/corpus-inicial-v1', portrait.path), path.join(out, filename));
  artist.picture = '/catalogo/' + filename;
}
await fs.writeFile(path.join(out, 'catalogo.json'), JSON.stringify({tracks, artists: [...artists.values()],
  provenance: {playlistSample: 25, djongaAlbumSample: djonga.body.data.length, completeDiscographies: false, fullLyricsBundled: false}}, null, 2));
console.log(`Catálogo local: ${tracks.length} músicas, ${artists.size} artistas, capas locais. Nenhuma letra embutida.`);
