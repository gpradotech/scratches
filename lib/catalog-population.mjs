import {normalize, uploadedCover, validateTrack} from '../app/src/domain/model.ts';

export const artistNameKey = name => normalize(name).replace(/[^a-z0-9]/g, '');
const safeUrl = value => {try {const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;} catch {return null;}};
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : null;
export function resolveArtist(rows, name) {
  return rows.filter(artist => artistNameKey(artist.name || '') === artistNameKey(name) && /^\d+$/.test(String(artist.id)))
    .sort((a, b) => (b.nb_fan || 0) - (a.nb_fan || 0))[0] ?? null;
}
export function deezerTrack(row, album) {
  if (row.readable === false || Array.isArray(row.available_countries) && !row.available_countries.includes('BR')) return null;
  if (!/^\d+$/.test(String(row.id)) || !row.title || !row.artist?.id) return null;
  if (album && String(album.id) !== String(row.album?.id)) throw new Error('O álbum retornado não corresponde à gravação.');
  const artists = [...new Map((row.contributors?.length ? row.contributors : [row.artist]).filter(a => a.id && a.name).map(a => [`deezer-artist:${a.id}`, {id: `deezer-artist:${a.id}`, name: a.name.trim()}])).values()];
  const track = {id: `deezer:${row.id}`, title: row.title.trim(), artists, album: row.album?.title || album?.title || '',
    albumId: row.album?.id ? `deezer-album:${row.album.id}` : null, duration: Number(row.duration) || 0,
    cover: safeUrl(album?.cover_big) || safeUrl(row.album?.cover_big) || safeUrl(row.album?.cover_medium),
    bpm: Number.isFinite(row.bpm) && row.bpm > 0 && row.bpm <= 400 ? row.bpm : null, key: null, mode: null,
    genres: [...new Set((album?.genres?.data || []).map(g => String(g.name || '').trim()).filter(Boolean))], genreScope: 'album',
    releaseDate: date(row.release_date) || date(album?.release_date), catalogAlbum: row.album?.title || album?.title || null,
    releaseType: ['album', 'single', 'ep', 'compilation'].includes(album?.record_type) ? album.record_type : null,
    source: safeUrl(row.link) || `https://www.deezer.com/track/${row.id}`, sourceMatch: 'provider_catalog', lyricsReferences: [],
    isrc: /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(row.isrc || '') ? row.isrc : null, languages: [], label: album?.label || null,
    explicit: typeof row.explicit_lyrics === 'boolean' ? row.explicit_lyrics : null,
    links: [{label: 'Deezer', url: `https://www.deezer.com/track/${row.id}`}]};
  validateTrack(track); return track;
}
export function mergePopulation(base, incoming, profiles, workspace = {}) {
  const personal = Object.values(workspace.tracks || {});
  const recordings = new Set([...base.tracks, ...personal].map(track => track.isrc).filter(Boolean));
  const personalIds = new Set(personal.map(track => track.id));
  const covers = new Map((workspace.metadata?.albums || []).filter(album => uploadedCover(album.cover)).map(album => [album.id, album.cover]));
  const tracks = new Map(base.tracks.map(track => [track.id, {...track, cover: uploadedCover(track.cover) ? track.cover : covers.get(track.albumId) || track.cover}]));
  let duplicates = 0;
  for (const track of incoming) {
    validateTrack(track);
    if (tracks.has(track.id) || personalIds.has(track.id) || track.isrc && recordings.has(track.isrc)) {duplicates++; continue;}
    tracks.set(track.id, {...track, cover: covers.get(track.albumId) || track.cover}); if (track.isrc) recordings.add(track.isrc);
  }
  const artists = new Map(profiles.map(artist => [artist.id, artist]));
  for (const artist of base.artists) artists.set(artist.id, artist);
  for (const artist of workspace.metadata?.artists || []) if (uploadedCover(artist.picture)) artists.set(artist.id, artist);
  for (const track of tracks.values()) for (const artist of track.artists) if (!artists.has(artist.id)) artists.set(artist.id, {...artist, picture: null});
  const used = new Set([...tracks.values()].flatMap(track => track.artists.map(artist => artist.id)));
  return {catalog: {tracks: [...tracks.values()], artists: [...artists.values()].filter(artist => used.has(artist.id))}, added: tracks.size - base.tracks.length, duplicates};
}
