export interface Artist {id: string; name: string; picture: string | null}
export type ReleaseType = 'album' | 'single' | 'ep' | 'compilation';
export interface Track {
  id: string; title: string; artists: {id: string; name: string}[]; album: string;
  duration: number; cover: string | null; bpm: number | null; key: number | null;
  mode: string | null; genres: string[]; genreScope: string; releaseDate: string | null;
  catalogAlbum: string | null; releaseType?: ReleaseType | null; source: string | null; sourceMatch: string;
  lyricsReferences: string[]; isrc: string | null;
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
export interface Workspace {schema: 2; revision: number; projects: Project[]; lyrics: Record<string, Lyric>}
export interface Interval {start: number; end: number}
export const emptyWorkspace = (): Workspace => ({schema: 2, revision: 0, projects: [], lyrics: {}});
export const normalize = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim();
export const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
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
