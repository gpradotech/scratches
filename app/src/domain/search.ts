import {lineAt, lyricLanguages, normalize} from './model.ts';
import type {Catalog, Track, Workspace} from './model.ts';
import {evaluateQuery, foldedOffsets, parseSearchQuery, termMatches, termPattern} from './searchQuery.ts';
import type {SearchQuery} from './searchQuery.ts';
export interface Filters {bpmMin: string; bpmMax: string; key: string[]; mode: string[]; genre: string[]; language: string[]; artist: string[]; theme: string; mood: string; hasBpm: boolean; hasTonality: boolean; hasLyrics: boolean}
export const emptyFilters: Filters = {bpmMin: '', bpmMax: '', key: [], mode: [], genre: [], language: [], artist: [], theme: '', mood: '', hasBpm: false, hasTonality: false, hasLyrics: false};
export const hasFilters = (f: Filters) => Object.values(f).some(value => Array.isArray(value) ? value.length > 0 : typeof value === 'boolean' ? value : value !== '');
// Quick availability toggles filter results without collapsing the exploration header.
export const hasFieldFilters = (f: Filters) => Object.values(f).some(value => Array.isArray(value) ? value.length > 0 : typeof value === 'string' && value !== '');
export function bpmInput(value: string): string | null {
  const numeric = value.replace(',', '.');
  return numeric === '' || (/^\d+(?:\.\d*)?$/.test(numeric) && Number(numeric) <= 400) ? numeric : null;
}
const singleMode = (values: string[]) => values.filter(value => value === 'major' || value === 'minor').slice(-1);
export function filtersFromParams(params: URLSearchParams): Filters {
  const values = (key: string) => [...new Set(params.getAll(key).map(value => value.trim()).filter(Boolean))];
  return {
    bpmMin: bpmInput(params.get('bpmMin') ?? '') ?? '', bpmMax: bpmInput(params.get('bpmMax') ?? '') ?? '',
    key: values('key'), mode: singleMode(params.getAll('mode').map(value => value.trim())), genre: values('genre'), language: values('language'), artist: values('artist'),
    theme: params.get('theme') ?? '', mood: params.get('mood') ?? '',
    hasBpm: (params.get('hasBpm') ?? params.get('hasAttributes')) === '1',
    hasTonality: (params.get('hasTonality') ?? params.get('hasAttributes')) === '1', hasLyrics: params.get('hasLyrics') === '1',
  };
}
export function filtersToParams(filters: Filters, base = new URLSearchParams()) {
  const params = new URLSearchParams(base);
  params.delete('modo');
  params.delete('unknown');
  params.delete('hasAttributes');
  params.delete('pagina');
  for (const [key, value] of Object.entries(filters)) {
    params.delete(key);
    if (Array.isArray(value)) for (const item of key === 'mode' ? singleMode(value) : value) params.append(key, item);
    else if (value) params.set(key, typeof value === 'boolean' ? '1' : value);
  }
  return params;
}
export function searchAll(c: Catalog, query: string, filters: Filters, workspace: Workspace) {
  const parsed = parseSearchQuery(query);
  return {...searchCatalog(c, query, filters, workspace, parsed), passages: searchPassages(c, query, filters, workspace, parsed)};
}
export function matchesFilters(t: Track, f: Filters, w: Workspace): boolean {
  const l = w.lyrics[t.id];
  if (f.hasBpm && (t.bpm === null || !Number.isFinite(t.bpm) || t.bpm <= 0 || t.bpm > 400)) return false;
  if (f.hasTonality && (t.key === null || !Number.isInteger(t.key) || t.key < 0 || t.key > 11 || !['major', 'minor'].includes(t.mode ?? ''))) return false;
  if (f.hasLyrics && !l?.text.trim()) return false;
  if ((f.bpmMin || f.bpmMax) && (t.bpm === null || !Number.isFinite(t.bpm) || t.bpm < Number(f.bpmMin || 0) || t.bpm > Number(f.bpmMax || Infinity))) return false;
  if (f.key.length && (t.key === null || !f.key.includes(String(t.key)))) return false;
  if (f.mode.length && !f.mode.includes(t.mode ?? '')) return false;
  if (f.genre.length && !t.genres.some(g => f.genre.some(genre => normalize(g) === normalize(genre)))) return false;
  const languages = [...lyricLanguages(l), ...(t.languages ?? [])];
  if (f.language.length && !languages.some(language => f.language.some(selected => normalize(language) === normalize(selected)))) return false;
  if (f.artist.length && !t.artists.some(a => f.artist.some(artist => normalize(a.name).includes(normalize(artist))))) return false;
  if (f.theme && !l?.themes.some(x => normalize(x).includes(normalize(f.theme)))) return false;
  if (f.mood && (!l?.mood || !normalize(l.mood).includes(normalize(f.mood)))) return false;
  return true;
}
const documentFor = (t: Track, w: Workspace) => ({intitle:t.title, artist:t.artists.map(a => a.name), album:t.catalogAlbum || t.album, inlyric:w.lyrics[t.id]?.text ?? ''});
export function searchCatalog(c: Catalog, query: string, f: Filters, w: Workspace, parsed = parseSearchQuery(query)) {
  const q = normalize(query);
  const tracks = c.tracks.filter(t => matchesFilters(t, f, w) && evaluateQuery(parsed, documentFor(t, w), 'catalog').matches);
  const score = (t: Track) => normalize(t.title) === q ? 0 : normalize(t.title).startsWith(q) ? 1 : 2;
  if (q) tracks.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title, 'pt-BR'));
  const artistTerms = parsed.groups.flat().filter(term => !term.exclude && (term.field === 'any' || term.field === 'artist'));
  const artists = q ? c.artists.filter(a => artistTerms.some(term => termMatches(a.name, term)) && tracks.some(t => t.artists.some(x => x.id === a.id))) : [];
  return {tracks, artists};
}
export interface PassageMatch {track: Track; start: number; end: number; text: string; startLine: number; endLine: number}
export function searchPassages(c: Catalog, query: string, f: Filters, w: Workspace, parsed: SearchQuery = parseSearchQuery(query)): PassageMatch[] {
  const results: PassageMatch[] = [];
  if (!parsed.groups.length) return results;
  for (const t of c.tracks) {
    const l = w.lyrics[t.id];
    if (!l || !matchesFilters(t, f, w)) continue;
    const evaluated = evaluateQuery(parsed, documentFor(t, w), 'passages');
    if (!evaluated.matches || !evaluated.lyricTerms.length) continue;
    const ranges = new Map<string, {start:number; end:number}>();
    let cursor = 0;
    const lines = l.text.split('\n').map(text => {const start = cursor; cursor += text.length + 1; return {start, end:start + text.length, folded:normalize(text).replace(/\s+/g,' ')};});
    let folded: ReturnType<typeof foldedOffsets> | undefined;
    for (const term of evaluated.lyricTerms) {
      const pattern = termPattern(term); let inlineMatches = 0;
      for (const line of lines) {
        const count = [...line.folded.matchAll(pattern)].length;
        if (count) {inlineMatches += count; ranges.set(line.start + ':' + line.end, line);}
      }
      // Most hits fit a line. Build character offsets only for cross-line phrases.
      if (!term.value.includes(' ') || [...normalize(l.text).replace(/\s+/g,' ').matchAll(pattern)].length <= inlineMatches) continue;
      folded ??= foldedOffsets(l.text);
      for (const match of folded.value.matchAll(pattern)) {
        const first = folded.starts[match.index!], last = folded.ends[match.index! + match[0].length - 1];
        const start = l.text.lastIndexOf('\n', first - 1) + 1;
        const nextLine = l.text.indexOf('\n', last);
        const end = nextLine === -1 ? l.text.length : nextLine;
        ranges.set(start + ':' + end, {start, end});
      }
    }
    for (const {start,end} of [...ranges.values()].sort((a,b) => a.start - b.start || a.end - b.end)) results.push({track:t, start, end, text:l.text.slice(start,end), startLine:lineAt(l.text,start), endLine:lineAt(l.text,end - 1)});
  }
  const seen = new Map<string, Set<string>>();
  return results.filter(result => {
    // Refrões repetidos representam um único material de pesquisa em cada música.
    // Conservar acentos e pontuação distingue versos diferentes; offsets são da primeira ocorrência.
    const key = result.text.normalize('NFC').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
    const trackTexts = seen.get(result.track.id) ?? new Set<string>();
    if (trackTexts.has(key)) return false;
    trackTexts.add(key); seen.set(result.track.id, trackTexts);
    return true;
  });
}
