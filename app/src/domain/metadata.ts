import type {AlbumMetadata, Artist, Catalog, SavedMetadata, Track, Workspace} from './model.ts';
import {normalize, safeLink, uploadedCover} from './model.ts';
export type MetadataKind = 'artist' | 'album' | 'genre' | 'label';
export interface MetadataOption {value: string; label: string; description?: string; artist?: Artist; album?: AlbumMetadata; disabled?: boolean}
export const isManagedAlbum = (album: AlbumMetadata) => album.id.startsWith('local-album:');
const uniqueNames = (values: string[]) => [...new Map(values.filter(v => v.trim()).map(v => [normalize(v), v])).values()];
export function albumForTrack(track: Track): AlbumMetadata | null {
  if (!track.album.trim()) return null;
  return {id: track.albumId || 'album:' + JSON.stringify([track.artists[0]?.id, normalize(track.album)]).slice(0, 190), title: track.album,
    artistIds: track.artists.map(a => a.id), artistNames: track.artists.map(a => a.name),
    cover: safeLink(track.cover) || uploadedCover(track.cover) ? track.cover : null, releaseDate: track.releaseDate, source: track.source, releaseType: track.releaseType};
}
export function collectMetadata(catalog: Catalog, workspace: Workspace): SavedMetadata {
  const saved = workspace.metadata;
  const artists = new Map((saved?.artists ?? []).map(a => [a.id, a]));
  const albums = new Map((saved?.albums ?? []).map(a => [a.id, a]));
  const tracks = [...catalog.tracks, ...Object.values(workspace.tracks ?? {})];
  for (const a of catalog.artists) artists.set(a.id, {...a, picture: a.picture ?? artists.get(a.id)?.picture ?? null});
  for (const track of tracks) {
    for (const a of track.artists) artists.set(a.id, {...artists.get(a.id), ...a, picture: artists.get(a.id)?.picture ?? null});
    const album = albumForTrack(track); if (album) albums.set(album.id, album);
  }
  return {artists: [...artists.values()], albums: [...albums.values()],
    genres: uniqueNames([...(saved?.genres ?? []), ...tracks.flatMap(t => t.genres)]),
    labels: uniqueNames([...(saved?.labels ?? []), ...tracks.map(t => t.label || '')]),
    languages: uniqueNames([...(saved?.languages ?? []), ...tracks.flatMap(t => t.languages ?? [])])};
}
export function metadataOptions(kind: MetadataKind, saved: SavedMetadata): MetadataOption[] {
  if (kind === 'artist') return saved.artists.map(a => ({value: a.id, label: a.name, artist: a, description: 'Seu acervo'}));
  if (kind === 'album') return saved.albums.filter(isManagedAlbum).map(a => ({value: a.id, label: a.title, album: a, description: 'Seu álbum' + (a.artistNames.length ? ' · ' + a.artistNames.join(', ') : '')}));
  return (kind === 'genre' ? saved.genres : saved.labels).map(label => ({value: normalize(label), label, description: 'Seu acervo'}));
}
export function createMetadataOption(kind: MetadataKind, name: string, artists: Artist[] = []): MetadataOption {
  const label = name.trim();
  if (kind === 'artist') {const artist = {id: 'local-artist:' + crypto.randomUUID(), name: label, picture: null}; return {value: artist.id, label, artist};}
  if (kind === 'album') {const album: AlbumMetadata = {id: 'local-album:' + crypto.randomUUID(), title: label, artistIds: artists.map(a => a.id), artistNames: artists.map(a => a.name), cover: null, releaseDate: null, source: null}; return {value: album.id, label, album};}
  return {value: normalize(label), label};
}
export const mergeMetadataOptions = (local: MetadataOption[], remote: MetadataOption[], kind?: MetadataKind) => {
  const key = (option: MetadataOption) => kind === 'genre' || kind === 'label' ? normalize(option.label) : option.value;
  const known = new Map(local.map(option => [key(option), option]));
  for (const option of remote) if (!known.has(key(option))) known.set(key(option), option);
  return [...known.values()];
};
