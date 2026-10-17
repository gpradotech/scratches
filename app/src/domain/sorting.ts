import type {Track} from './model.ts';

export const sortLabels = {sequence: 'Número', title: 'Título', artist: 'Artista', album: 'Álbum', bpm: 'BPM', duration: 'Duração'};
export type SortKey = keyof typeof sortLabels;
export type SortColumn = Exclude<SortKey, 'artist'>;
export type TrackSort = {key: SortKey; direction: 'asc' | 'desc'} | null;
const alphabet = new Intl.Collator('pt-BR', {sensitivity: 'base', numeric: true});
export function sortFromParams(params: URLSearchParams): TrackSort {
  const parts = (params.get('ordenar') ?? '').split('-');
  const [key, direction] = parts;
  if (key === 'sequence' && direction === 'asc') return null;
  return parts.length === 2 && Object.hasOwn(sortLabels, key) && (direction === 'asc' || direction === 'desc') ? {key: key as SortKey, direction} : null;
}
export function sortColumn(sort: TrackSort): SortColumn | null {return sort?.key === 'artist' ? 'title' : sort?.key ?? null;}
export function trackListNumber(position: number, total: number, sort: TrackSort): number {
  return sort?.key === 'sequence' && sort.direction === 'desc' ? total - position : position + 1;
}
export function nextTrackSort(current: TrackSort, column: SortColumn): TrackSort {
  if (column === 'sequence') return current?.key === 'sequence' && current.direction === 'desc' ? null : {key: 'sequence', direction: 'desc'};
  const keys: SortKey[] = column === 'title' ? ['title', 'title', 'artist', 'artist'] : [column, column];
  const step = sortColumn(current) === column ? keys.findIndex((key, index) => key === current?.key && (index % 2 === 0 ? 'asc' : 'desc') === current?.direction) + 1 : 0;
  return step >= keys.length ? null : {key: keys[step], direction: step % 2 === 0 ? 'asc' : 'desc'};
}
export function sortingParams(base: URLSearchParams, sort: TrackSort) {
  const params = new URLSearchParams(base);
  params.delete('pagina');
  if (sort) params.set('ordenar', `${sort.key}-${sort.direction}`); else params.delete('ordenar');
  return params;
}
export function sortTracks(tracks: Track[], sort: TrackSort): Track[] {
  if (!sort) return [...tracks];
  const numeric = sort.key === 'sequence' || sort.key === 'duration' || sort.key === 'bpm';
  const value = (track: Track, index: number) => sort.key === 'sequence' ? index : sort.key === 'duration' ? track.duration : sort.key === 'artist' ? track.artists.map(artist => artist.name).join(', ') : track[sort.key];
  const missing = (value: string | number | null) => numeric ? !Number.isFinite(value) || Number(value) < 0 : typeof value !== 'string' || !value.trim();
  const direction = sort.direction === 'asc' ? 1 : -1;
  return tracks.map((track, index) => ({track, index, value: value(track, index)})).sort((a, b) => {
    const am = missing(a.value), bm = missing(b.value);
    if (am !== bm) return am ? 1 : -1;
    const compared = am ? 0 : numeric ? Number(a.value) - Number(b.value) : alphabet.compare(String(a.value), String(b.value));
    return compared * direction || a.index - b.index;
  }).map(item => item.track);
}
export function sortAnnouncement(sort: TrackSort) {
  return sort ? `Lista ordenada por ${sortLabels[sort.key].toLocaleLowerCase('pt-BR')}, ${sort.key === 'duration' || sort.key === 'sequence' || sort.key === 'bpm' ? sort.direction === 'asc' ? 'do menor para o maior' : 'do maior para o menor' : sort.direction === 'asc' ? 'de A a Z' : 'de Z a A'}.` : 'Exibindo a ordem padrão da lista.';
}
