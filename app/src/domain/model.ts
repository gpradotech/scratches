export interface Artist {id: string; name: string; picture: string | null}
export interface AlbumMetadata {id: string; title: string; artistIds: string[]; artistNames: string[]; cover: string | null; releaseDate: string | null; source: string | null; releaseType?: ReleaseType | null}
export interface SavedMetadata {artists: Artist[]; albums: AlbumMetadata[]; genres: string[]; labels: string[]; languages: string[]}
export type ReleaseType = 'album' | 'single' | 'ep' | 'compilation';
export const metadataFields = ['title', 'artists', 'album', 'duration', 'cover', 'bpm', 'key', 'mode', 'genres', 'languages', 'releaseDate', 'releaseType', 'explicit', 'isrc', 'label', 'source'] as const;
export type MetadataField = typeof metadataFields[number];
export interface Track {
  id: string; title: string; artists: {id: string; name: string}[]; album: string;
  duration: number; cover: string | null; bpm: number | null; key: number | null;
  mode: string | null; genres: string[]; genreScope: string; releaseDate: string | null;
  catalogAlbum: string | null; releaseType?: ReleaseType | null; source: string | null; sourceMatch: string;
  lyricsReferences: string[]; isrc: string | null;
  languages?: string[]; label?: string | null; explicit?: boolean | null;
  links?: {label: string; url: string}[];
  albumId?: string | null;
  metadataOrigins?: Partial<Record<MetadataField, 'imported' | 'manual'>>;
}
export interface Catalog {tracks: Track[]; artists: Artist[]}
interface LyricContent {
  trackId: string; text: string; revision: string; source: string; importedAt: string;
  themes: string[]; mood: string;
}
export type Lyric = LyricContent & (
  {languages: string[]; language?: never} |
  // Compatibilidade com letras e backups salvos antes da seleção de vários idiomas.
  {language: string; languages?: never}
);
export const lyricLanguages = (lyric?: Lyric): string[] => lyric?.languages ?? (lyric?.language ? [lyric.language] : []);
export interface Fragment {
  id: string; trackId: string; lyricRevision: string; start: number; end: number;
  text: string; startLine: number; endLine: number; savedAt: string;
}
export interface Project {id: string; name: string; createdAt: string; updatedAt: string; fragments: Fragment[]}
// personalTrackIds só é aceito por compatibilidade com backups; o catálogo atual é único.
export interface Workspace {schema: 2; revision: number; projects: Project[]; lyrics: Record<string, Lyric>; tracks?: Record<string, Track>; metadata?: SavedMetadata; personalTrackIds?: string[]}
export interface Interval {start: number; end: number}
export const emptyWorkspace = (): Workspace => ({schema: 2, revision: 0, projects: [], lyrics: {}});
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
export const duration = (seconds: number) => seconds > 0 ? (seconds >= 3600 ? `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:` : `${Math.floor(seconds / 60)}:`) + String(Math.floor(seconds % 60)).padStart(2, '0') : '—';
export const keyNames = ['Dó', 'Dó♯', 'Ré', 'Ré♯', 'Mi', 'Fá', 'Fá♯', 'Sol', 'Sol♯', 'Lá', 'Lá♯', 'Si'];
export function lineAt(text: string, offset: number) {
  let start = 0; let number = 0;
  for (const line of text.split('\n')) {
    if (line.trim()) number++;
    if (offset <= start + line.length) return Math.max(1, number);
    start += line.length + 1;
  }
  return Math.max(1, number);
}
// Trechos antigos conservam seus offsets; derive os rótulos pela versão atual quando disponível.
export function fragmentLines(fragment: Fragment, lyric?: Lyric) {
  return lyric?.revision === fragment.lyricRevision
    ? {startLine: lineAt(lyric.text, fragment.start), endLine: lineAt(lyric.text, fragment.end - 1)}
    : {startLine: fragment.startLine, endLine: fragment.endLine};
}
export function makeFragment(trackId: string, lyric: Lyric, range: Interval): Fragment {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end > lyric.text.length || range.end <= range.start || !lyric.text.slice(range.start, range.end).trim()) throw new Error('Selecione um trecho de texto válido.');
  return {id: crypto.randomUUID(), trackId, lyricRevision: lyric.revision, ...range,
    text: lyric.text.slice(range.start, range.end), startLine: lineAt(lyric.text, range.start),
    endLine: lineAt(lyric.text, range.end - 1), savedAt: new Date().toISOString()};
}
export function saveFragments(workspace: Workspace, projectId: string, fragments: Fragment[], newName?: string) {
  const now = new Date().toISOString();
  const name = newName?.trim();
  if (newName !== undefined && (!name || name.length > 100)) throw new Error('Dê ao projeto um nome de até 100 caracteres.');
  const project: Project | undefined = name ? {id: crypto.randomUUID(), name, createdAt: now, updatedAt: now, fragments: []} : workspace.projects.find(p => p.id === projectId);
  if (!project) throw new Error('Escolha um projeto.');
  const {additions, duplicates} = assessFragmentSelection(project, fragments);
  if (!additions.length && !name) return {workspace, project, added: 0, duplicates};
  const updated = {...project, updatedAt: now, fragments: [...project.fragments, ...additions]};
  return {workspace: {...workspace, projects: name ? [...workspace.projects, updated] : workspace.projects.map(p => p.id === project.id ? updated : p)},
    project: updated, added: additions.length, duplicates};
}
export const fragmentKey = (f: Fragment) => `${f.trackId}|${f.lyricRevision}|${f.start}|${f.end}`;
export function assessFragmentSelection(project: Project, fragments: Fragment[]) {
  const keys = new Set(project.fragments.map(fragmentKey));
  const additions = fragments.filter(fragment => {const key = fragmentKey(fragment); if (keys.has(key)) return false; keys.add(key); return true;});
  return {additions, duplicates: fragments.length - additions.length};
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
export function validateWorkspace(value: unknown): asserts value is Workspace {
  if (!object(value) || value.schema !== 2 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !Array.isArray(value.projects) || value.projects.length > 2000 || !object(value.lyrics)) throw new Error('Backup inválido: formato de espaço de trabalho incompatível.');
  if (value.personalTrackIds !== undefined && (!Array.isArray(value.personalTrackIds) || value.personalTrackIds.length > 10000 || value.personalTrackIds.some(id => !text(id, 200) || !String(id).trim()) || new Set(value.personalTrackIds).size !== value.personalTrackIds.length)) throw new Error('Catálogo pessoal inválido.');
  if (value.metadata !== undefined) {
    const m = value.metadata;
    const names = (v: unknown, limit: number, max = 100) => Array.isArray(v) && v.length <= limit && v.every(item => text(item, max) && String(item).trim());
    if (!object(m) || !Array.isArray(m.artists) || m.artists.length > 5000 || !Array.isArray(m.albums) || m.albums.length > 5000 || !names(m.genres, 1000) || !names(m.labels, 1000, 300) || !names(m.languages, 300)) throw new Error('Metadados locais incompatíveis.');
    for (const a of m.artists) if (!object(a) || !text(a.id, 200) || !String(a.id).trim() || !text(a.name, 100) || !String(a.name).trim() || (a.picture !== null && !safeLink(a.picture) && !uploadedCover(a.picture) && !(typeof a.picture === 'string' && /^\/catalogo\/[\w.-]+$/.test(a.picture)))) throw new Error('Artista local inválido.');
    for (const a of m.albums) if (!object(a) || !text(a.id, 200) || !String(a.id).trim() || !text(a.title, 300) || !String(a.title).trim() || !names(a.artistIds, 30, 200) || !names(a.artistNames, 30) || (a.cover !== null && !safeLink(a.cover) && !uploadedCover(a.cover)) || (a.source !== null && !safeLink(a.source)) || (a.releaseDate !== null && !text(a.releaseDate, 10))) throw new Error('Álbum local inválido.');
    if (m.albums.some(a => a.releaseType !== undefined && ![null, 'album', 'single', 'ep', 'compilation'].includes(a.releaseType as string | null))) throw new Error('Tipo de lançamento local inválido.');
    if (new Set(m.artists.map(a => a.id)).size !== m.artists.length || new Set(m.albums.map(a => a.id)).size !== m.albums.length) throw new Error('Metadados locais duplicados.');
  }
  if (value.tracks !== undefined) {
    if (!object(value.tracks) || Object.keys(value.tracks).length > 5000) throw new Error('O espaço comporta até 5.000 músicas adicionadas ou editadas.');
    for (const [id, track] of Object.entries(value.tracks)) {validateTrack(track); if (id !== track.id) throw new Error('Música com identificador inconsistente.');}
  }
  const ids = new Set<string>();
  for (const p of value.projects) {
    if (!object(p) || !text(p.id, 200) || !text(p.name, 100) || !String(p.name).trim() || !text(p.createdAt, 100) || !text(p.updatedAt, 100) || !Array.isArray(p.fragments) || p.fragments.length > 20000 || ids.has(String(p.id))) throw new Error('Backup inválido: projeto inconsistente.');
    ids.add(String(p.id));
    const fragmentIds = new Set<string>(); const keys = new Set<string>();
    for (const f of p.fragments) {
      if (!object(f) || !text(f.id, 200) || !text(f.trackId, 200) || !text(f.lyricRevision, 200) || !text(f.text, 100000) || !String(f.text).trim() || !text(f.savedAt, 100) || !Number.isSafeInteger(f.start) || !Number.isSafeInteger(f.end) || Number(f.start) < 0 || Number(f.end) <= Number(f.start) || Number(f.end) - Number(f.start) !== String(f.text).length || !Number.isSafeInteger(f.startLine) || !Number.isSafeInteger(f.endLine) || Number(f.startLine) < 1 || Number(f.endLine) < Number(f.startLine)) throw new Error('Backup inválido: trecho inconsistente.');
      const key = fragmentKey(f as unknown as Fragment);
      if (fragmentIds.has(String(f.id)) || keys.has(key)) throw new Error('Backup inválido: trechos duplicados.');
      fragmentIds.add(String(f.id)); keys.add(key);
    }
  }
  if (Object.keys(value.lyrics).length > 5000) throw new Error('O backup ultrapassa o limite de 5.000 letras por espaço de trabalho.');
  for (const [key, l] of Object.entries(value.lyrics)) {
    const validLanguages = object(l) && (l.languages === undefined ? text(l.language, 100)
      : l.language === undefined && Array.isArray(l.languages) && l.languages.every(item => typeof item === 'string' && item.length <= 100 && item.trim()) && new Set(l.languages.map(item => normalize(item as string))).size === l.languages.length);
    if (!object(l) || key !== l.trackId || !text(l.trackId, 200) || !text(l.text, 100000) || !String(l.text).trim() || !text(l.revision, 200) || !text(l.source, 500) || !text(l.importedAt, 100) || !validLanguages || !text(l.mood, 100) || !Array.isArray(l.themes) || l.themes.length > 30 || l.themes.some(t => !text(t, 100))) throw new Error('Backup inválido: letra inconsistente.');
  }
}
export function safeLink(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;}
  catch {return false;}
}
export function uploadedCover(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 750000) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4) return false;
  try {const head = atob(match[2].slice(0, 32)); return match[1] === 'png' ? head.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? head.startsWith('\xff\xd8\xff') : head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP';} catch {return false;}
}
export function validateTrack(value: unknown): asserts value is Track {
  if (object(value) && value.metadataOrigins !== undefined && (!object(value.metadataOrigins) || Object.entries(value.metadataOrigins).some(([key, origin]) => !metadataFields.includes(key as MetadataField) || !['imported', 'manual'].includes(String(origin))))) throw new Error('Origem dos metadados inválida.');
  const list = (v: unknown, max = 30) => Array.isArray(v) && v.length <= max && v.every(item => text(item, 100) && String(item).trim());
  if (!object(value) || !text(value.id, 200) || !String(value.id).trim() || !text(value.title, 300) || !String(value.title).trim() || !Array.isArray(value.artists) || !value.artists.length || value.artists.length > 30 || value.artists.some(a => !object(a) || !text(a.id, 200) || !String(a.id).trim() || !text(a.name, 100) || !String(a.name).trim()) || !text(value.album, 300)) throw new Error('Informe o título e pelo menos um artista válido.');
  if (new Set(value.artists.map(a => a.id)).size !== value.artists.length) throw new Error('Remova os artistas repetidos.');
  if (typeof value.duration !== 'number' || !Number.isFinite(value.duration) || value.duration < 0 || value.duration > 359999 || (value.bpm !== null && (typeof value.bpm !== 'number' || !Number.isFinite(value.bpm) || value.bpm <= 0 || value.bpm > 400)) || (value.key !== null && (!Number.isInteger(value.key) || Number(value.key) < 0 || Number(value.key) > 11)) || ![null, 'major', 'minor'].includes(value.mode as string | null)) throw new Error('Confira duração, BPM, tom e modo. Campos desconhecidos podem ficar vazios.');
  if (!list(value.genres) || !['album', 'track'].includes(String(value.genreScope)) || (value.languages !== undefined && !list(value.languages))) throw new Error('Confira os gêneros e idiomas informados.');
  if ((value.releaseDate !== null && (typeof value.releaseDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.releaseDate) || Number.isNaN(Date.parse(value.releaseDate)) || new Date(value.releaseDate).toISOString().slice(0, 10) !== value.releaseDate)) || (value.releaseType !== undefined && ![null, 'album', 'single', 'ep', 'compilation'].includes(value.releaseType as string | null))) throw new Error('Confira a data e o tipo de lançamento.');
  if ((value.cover !== null && !(typeof value.cover === 'string' && /^\/catalogo\/[a-zA-Z0-9._-]+$/.test(value.cover)) && !safeLink(value.cover) && !uploadedCover(value.cover)) || (value.source !== null && !safeLink(value.source)) || !Array.isArray(value.lyricsReferences) || value.lyricsReferences.length > 30 || !value.lyricsReferences.every(safeLink) || (value.links !== undefined && (!Array.isArray(value.links) || value.links.length > 30 || value.links.some(l => !object(l) || !text(l.label, 100) || !safeLink(l.url))))) throw new Error('Use uma imagem válida ou um endereço http ou https para a capa e as fontes.');
  if (value.albumId !== undefined && value.albumId !== null && !text(value.albumId, 200)) throw new Error('Identificador de álbum inválido.');
  if (!text(value.sourceMatch, 100) || (value.catalogAlbum !== null && !text(value.catalogAlbum, 300)) || (value.isrc !== null && (typeof value.isrc !== 'string' || !/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(value.isrc))) || (value.label !== undefined && value.label !== null && !text(value.label, 300)) || (value.explicit !== undefined && ![null, true, false].includes(value.explicit as boolean | null))) throw new Error('Confira o ISRC e as informações da fonte.');
}
