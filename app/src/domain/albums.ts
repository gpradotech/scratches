import type {Catalog, ReleaseType, Track} from './model.ts';

// A identidade usa o álbum informado no catálogo e seu artista principal.
// Participações variam entre faixas e não devem dividir um mesmo álbum.
export function albumId(track: Track): string {
  if (track.albumId?.startsWith('local-album:')) return track.albumId;
  return JSON.stringify([track.artists[0]?.id ?? '', track.album.normalize('NFC').trim().toLocaleLowerCase('pt-BR')]);
}

export function findAlbum(catalog: Catalog, id: string) {
  const tracks = catalog.tracks.filter(track => albumId(track) === id);
  if (!tracks.length) return undefined;
  // Algumas fontes identificam a música em outra edição ou em um single.
  // Só represente a capa do álbum quando o título da edição corresponder.
  const coverTrack = tracks.find(track => track.cover && track.catalogAlbum?.normalize('NFC').trim().toLocaleLowerCase('pt-BR') === track.album.normalize('NFC').trim().toLocaleLowerCase('pt-BR'));
  const dates = tracks.filter(track => track.catalogAlbum?.normalize('NFC').trim().toLocaleLowerCase('pt-BR') === track.album.normalize('NFC').trim().toLocaleLowerCase('pt-BR'))
    .map(track => track.releaseDate).filter((date): date is string => !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date);
  const releaseDate = new Set(dates).size === 1 ? dates[0] : null;
  const types = tracks.filter(track => track.catalogAlbum?.normalize('NFC').trim().toLocaleLowerCase('pt-BR') === track.album.normalize('NFC').trim().toLocaleLowerCase('pt-BR'))
    .map(track => track.releaseType).filter((type): type is ReleaseType => !!type && ['album', 'single', 'ep', 'compilation'].includes(type));
  const releaseType = new Set(types).size === 1 ? types[0] : null;
  return {id, title: tracks[0].album || 'Álbum não informado', artist: tracks[0].artists[0], tracks, coverTrack, releaseDate, releaseType,
    duration: tracks.reduce((total, track) => total + track.duration, 0)};
}
export type CatalogAlbum = NonNullable<ReturnType<typeof findAlbum>>;
export const releaseTypeLabels: Record<ReleaseType, string> = {album: 'Álbum', single: 'Single', ep: 'EP', compilation: 'Compilação'};

export function artistAlbums(catalog: Catalog, artistId: string): CatalogAlbum[] {
  const available = catalog.tracks.filter(track => track.artists.some(artist => artist.id === artistId));
  const ids = [...new Set(available.map(albumId))];
  // Guest appearances keep their album identity, while showing only this artist's tracks.
  return ids.map(id => {
    const album = findAlbum(catalog, id)!;
    const tracks = available.filter(track => albumId(track) === id);
    return {...album, tracks, duration: tracks.reduce((total, track) => total + track.duration, 0)};
  });
}

export type AlbumSort = 'recent' | 'oldest' | 'title-asc' | 'title-desc';
export function nextAlbumSort(sort: AlbumSort): AlbumSort {
  return sort === 'recent' ? 'oldest' : sort === 'oldest' ? 'title-asc' : sort === 'title-asc' ? 'title-desc' : 'recent';
}
export const albumSortLabels: Record<AlbumSort, string> = {
  recent: 'Data de lançamento: mais recentes primeiro', oldest: 'Data de lançamento: mais antigos primeiro',
  'title-asc': 'Título: A–Z', 'title-desc': 'Título: Z–A',
};
export const releaseFilters = [
  {value: 'all', label: 'Todas'}, {value: 'album', label: 'Álbuns'},
  {value: 'single-ep', label: 'Singles e EPs'}, {value: 'compilation', label: 'Compilações'},
] as const;
export type ReleaseFilter = typeof releaseFilters[number]['value'];
export function releaseFilterFromParams(params: URLSearchParams): ReleaseFilter {
  return releaseFilters.find(option => option.value === params.get('tipoLancamento'))?.value ?? 'all';
}
export function releaseFilterParams(base: URLSearchParams, filter: ReleaseFilter) {
  const params = new URLSearchParams(base);
  params.delete('pagina');
  if (filter === 'all') params.delete('tipoLancamento'); else params.set('tipoLancamento', filter);
  return params;
}
export function filterAlbums(albums: CatalogAlbum[], filter: ReleaseFilter): CatalogAlbum[] {
  return filter === 'all' ? albums : albums.filter(album => filter === 'single-ep'
    ? album.releaseType === 'single' || album.releaseType === 'ep' : album.releaseType === filter);
}
export function albumSortFromParams(params: URLSearchParams): AlbumSort {
  const sort = params.get('ordenarAlbuns');
  return sort === 'oldest' || sort === 'title-asc' || sort === 'title-desc' ? sort : 'recent';
}
export function albumSortParams(base: URLSearchParams, sort: AlbumSort) {
  const params = new URLSearchParams(base);
  params.delete('pagina');
  if (sort === 'recent') params.delete('ordenarAlbuns'); else params.set('ordenarAlbuns', sort);
  return params;
}
export function sortAlbums(albums: CatalogAlbum[], sort: AlbumSort): CatalogAlbum[] {
  const alphabet = new Intl.Collator('pt-BR', {sensitivity: 'base', numeric: true});
  return albums.toSorted((a, b) => {
    const title = alphabet.compare(a.title, b.title) || alphabet.compare(a.artist?.name ?? '', b.artist?.name ?? '') || a.id.localeCompare(b.id);
    if (sort === 'title-asc' || sort === 'title-desc') return title * (sort === 'title-desc' ? -1 : 1);
    if (!!a.releaseDate !== !!b.releaseDate) return a.releaseDate ? -1 : 1;
    return (a.releaseDate && b.releaseDate ? a.releaseDate.localeCompare(b.releaseDate) * (sort === 'recent' ? -1 : 1) : 0) || title;
  });
}
