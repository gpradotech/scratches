import {normalize, validateTrack} from './model.ts';
import type {Artist, Catalog, Track, Workspace} from './model.ts';
import {collectMetadata} from './metadata.ts';
import {completeMetadata, hasMetadataValue, isImportedTrack, markImportedMetadata, metadataOrigin} from './metadataOrigins.ts';
import {metadataFields} from './model.ts';

export function mergeCatalog(base: Catalog, workspace: Workspace): Catalog {
  const tracks = new Map(base.tracks.map(track => [track.id, track]));
  for (const track of Object.values(workspace.tracks ?? {})) tracks.set(track.id, track);
  const artists = new Map(base.artists.map(artist => [artist.id, artist]));
  for (const artist of workspace.metadata?.artists ?? []) artists.set(artist.id, {...artist, picture: artist.picture ?? artists.get(artist.id)?.picture ?? null});
  for (const track of tracks.values()) for (const artist of track.artists) artists.set(artist.id, {...artists.get(artist.id), ...artist, picture: artists.get(artist.id)?.picture ?? null});
  const used = new Set([...tracks.values()].flatMap(track => track.artists.map(a => a.id)));
  return {tracks: [...tracks.values()], artists: [...artists.values()].filter(a => used.has(a.id))};
}
export const newTrack = (): Track => ({id: 'local:' + crypto.randomUUID(), title: '', artists: [], album: '',
  duration: 0, cover: null, bpm: null, key: null, mode: null, genres: [], genreScope: 'track',
  releaseDate: null, catalogAlbum: null, releaseType: null, source: null, sourceMatch: 'manual', lyricsReferences: [], isrc: null, languages: []});

export function applyFoundMetadata(current: Track, found: Track): Track {
  if (isImportedTrack(current)) throw new Error('Os metadados importados estão protegidos. Complemente apenas os campos ausentes.');
  const links = [...new Map([...(current.links ?? []), ...(found.links ?? [])].map(link => [link.url, link])).values()];
  const next = {...current, ...found, id: current.id, album: found.album || current.album,
    cover: found.cover ?? current.cover, bpm: found.bpm ?? current.bpm, key: found.key ?? current.key,
    mode: found.mode ?? current.mode, duration: found.duration || current.duration,
    genres: found.genres.length ? found.genres : current.genres,
    genreScope: found.genres.length ? found.genreScope : current.genreScope,
    languages: found.languages?.length ? found.languages : current.languages,
    releaseDate: found.releaseDate ?? current.releaseDate, releaseType: found.releaseType ?? current.releaseType,
    isrc: found.isrc ?? current.isrc, label: found.label ?? current.label,
    lyricsReferences: current.lyricsReferences, links};
  return {...next, metadataOrigins: Object.fromEntries(metadataFields.filter(field => hasMetadataValue(next, field)).map(field => [field, hasMetadataValue(found, field) ? 'imported' : metadataOrigin(current, field) ?? 'manual']))};
}
export const canDeleteGeneralTrack = (workspace: Workspace, base: Catalog, id: string) =>
  id.startsWith('local:') && !!workspace.tracks?.[id] && !base.tracks.some(track => track.id === id);
export function deleteGeneralTrack(workspace: Workspace, base: Catalog, id: string): Workspace {
  if (!canDeleteGeneralTrack(workspace, base, id)) throw new Error('Somente músicas cadastradas manualmente por você podem ser excluídas do catálogo.');
  const tracks = {...workspace.tracks}; delete tracks[id];
  return {...workspace, tracks};
}
const releaseKey = (track: Track) => track.album ? track.albumId || JSON.stringify([track.artists[0]?.id, normalize(track.album)]) : null;
export function albumTracks(catalog: Catalog, albumId: string, excludingId?: string): Track[] {
  return catalog.tracks.filter(track => track.id !== excludingId && track.albumId === albumId);
}
export function saveTrack(workspace: Workspace, base: Catalog, track: Track, editingId?: string, artistProfiles: Artist[] = []): Workspace {
  validateTrack(track);
  if (editingId && editingId !== track.id) throw new Error('A edição deve preservar a identidade da música.');
  const original = mergeCatalog(base, workspace).tracks.find(item => item.id === editingId);
  if (original) track = completeMetadata(original, track);
  else if (isImportedTrack(track) && !track.metadataOrigins) track = markImportedMetadata(track);
  const duplicate = mergeCatalog(base, workspace).tracks.find(item => item.id !== editingId &&
    (item.id === track.id || (item.isrc && track.isrc && normalize(item.isrc) === normalize(track.isrc))));
  if (duplicate) throw new Error(`“${duplicate.title}” já está no catálogo. Abra essa música para consultar ou complementar seus metadados.`);
  const others = mergeCatalog(base, workspace).tracks.filter(item => item.id !== track.id && !isImportedTrack(item) && releaseKey(track) !== null && releaseKey(item) === releaseKey(track));
  const previousType = others.find(item => item.releaseType)?.releaseType;
  if (!isImportedTrack(track) && others.length && (track.releaseType === 'single' || others.some(item => item.releaseType === 'single'))) throw new Error('Um Single comporta apenas uma música. Crie outro lançamento ou edite o tipo do Single existente primeiro.');
  let releaseType = !isImportedTrack(track) && !editingId && previousType ? previousType : track.releaseType;
  if (!isImportedTrack(track) && releaseType === 'ep' && (others.length + 1 > 7 || others.reduce((total, item) => total + item.duration, track.duration) > 1800)) releaseType = 'album';
  track = {...track, releaseType};
  const tracks = {...workspace.tracks, [track.id]: track};
  if (!isImportedTrack(track)) for (const item of others) tracks[item.id] = {...item, releaseType};
  const metadata = collectMetadata(base, {...workspace, tracks});
  const profiles = new Map(artistProfiles.map(artist => [artist.id, artist]));
  metadata.artists = metadata.artists.map(artist => ({...artist, picture: profiles.get(artist.id)?.picture ?? artist.picture}));
  return {...workspace, tracks, metadata};
}
