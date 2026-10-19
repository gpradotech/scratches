import {metadataFields} from './model.ts';
import type {MetadataField, Track} from './model.ts';

export const metadataLabels: Record<MetadataField, string> = {title: 'Título', artists: 'Artistas', album: 'Álbum', duration: 'Duração', cover: 'Capa', bpm: 'BPM', key: 'Tom', mode: 'Modo', genres: 'Gêneros', languages: 'Idiomas', releaseDate: 'Data de lançamento', releaseType: 'Tipo de lançamento', explicit: 'Conteúdo explícito', isrc: 'ISRC', label: 'Gravadora', source: 'Fonte dos metadados'};
export const isImportedTrack = (track: Track) => !!track.metadataOrigins && Object.values(track.metadataOrigins).includes('imported') || track.sourceMatch !== 'manual' && (!!track.source || /^(deezer|itunes|spotify):/.test(track.id));
export function hasMetadataValue(track: Track, field: MetadataField): boolean {
  const value = track[field];
  if (field === 'duration' || field === 'bpm') return typeof value === 'number' && value > 0;
  return Array.isArray(value) ? value.length > 0 : typeof value === 'string' ? !!value.trim() : value !== null && value !== undefined;
}
export function metadataOrigin(track: Track, field: MetadataField) {
  return track.metadataOrigins?.[field] ?? (hasMetadataValue(track, field) ? isImportedTrack(track) ? 'imported' : 'manual' : undefined);
}
export const isImportedField = (track: Track, field: MetadataField) => metadataOrigin(track, field) === 'imported';
export function markImportedMetadata(track: Track): Track {
  return {...track, metadataOrigins: Object.fromEntries(metadataFields.filter(field => hasMetadataValue(track, field)).map(field => [field, 'imported']))};
}
// A origem é calculada sobre o registro anterior, nunca aceita do formulário.
export function completeMetadata(original: Track, next: Track): Track {
  if (!isImportedTrack(original)) return next;
  const origins: NonNullable<Track['metadataOrigins']> = {};
  for (const field of metadataFields) {
    if (isImportedField(original, field)) {
      if (JSON.stringify(original[field]) !== JSON.stringify(next[field])) throw new Error(`${metadataLabels[field]} foi importado e não pode ser alterado. Preencha apenas os dados ausentes.`);
      origins[field] = 'imported';
    } else if (hasMetadataValue(next, field)) origins[field] = 'manual';
  }
  for (const field of ['sourceMatch', 'links', 'lyricsReferences'] as const) {
    if (JSON.stringify(original[field]) !== JSON.stringify(next[field])) throw new Error('A identificação e as referências importadas devem ser preservadas.');
  }
  if (isImportedField(original, 'album') && (original.albumId !== next.albumId || original.catalogAlbum !== next.catalogAlbum)) throw new Error('O álbum importado deve ser preservado.');
  if (isImportedField(original, 'genres') && original.genreScope !== next.genreScope) throw new Error('A origem do gênero importado deve ser preservada.');
  return {...next, metadataOrigins: origins};
}
