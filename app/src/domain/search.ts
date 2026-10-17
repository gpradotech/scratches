import {lineAt, lyricLanguages, normalize} from './model.ts';
import type {Catalog, Track, Workspace} from './model.ts';
export interface Filters {bpmMin: string; bpmMax: string; key: string[]; mode: string[]; genre: string[]; language: string[]; artist: string[]; theme: string; mood: string; hasAttributes: boolean; hasLyrics: boolean}
export const emptyFilters: Filters = {bpmMin: '', bpmMax: '', key: [], mode: [], genre: [], language: [], artist: [], theme: '', mood: '', hasAttributes: false, hasLyrics: false};
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
    theme: params.get('theme') ?? '', mood: params.get('mood') ?? '', hasAttributes: params.get('hasAttributes') === '1', hasLyrics: params.get('hasLyrics') === '1',
  };
}
export function filtersToParams(filters: Filters, base = new URLSearchParams()) {
  const params = new URLSearchParams(base);
  params.delete('modo');
  params.delete('unknown');
  params.delete('pagina');
  for (const [key, value] of Object.entries(filters)) {
    params.delete(key);
    if (Array.isArray(value)) for (const item of key === 'mode' ? singleMode(value) : value) params.append(key, item);
    else if (value) params.set(key, typeof value === 'boolean' ? '1' : value);
  }
  return params;
}
export function searchAll(c: Catalog, query: string, filters: Filters, workspace: Workspace) {
  return {...searchCatalog(c, query, filters, workspace), passages: searchPassages(c, query, filters, workspace)};
}
export function matchesFilters(t: Track, f: Filters, w: Workspace): boolean {
  const l = w.lyrics[t.id];
  if (f.hasAttributes && (t.bpm === null || !Number.isFinite(t.bpm) || t.key === null || !Number.isInteger(t.key) || t.key < 0 || t.key > 11 || !['major', 'minor'].includes(t.mode ?? ''))) return false;
  if (f.hasLyrics && !l?.text.trim()) return false;
  if ((f.bpmMin || f.bpmMax) && (t.bpm === null || !Number.isFinite(t.bpm) || t.bpm < Number(f.bpmMin || 0) || t.bpm > Number(f.bpmMax || Infinity))) return false;
  if (f.key.length && (t.key === null || !f.key.includes(String(t.key)))) return false;
  if (f.mode.length && !f.mode.includes(t.mode ?? '')) return false;
  if (f.genre.length && !t.genres.some(g => f.genre.some(genre => normalize(g) === normalize(genre)))) return false;
  const languages = lyricLanguages(l);
  if (f.language.length && !languages.some(language => f.language.some(selected => normalize(language) === normalize(selected)))) return false;
  if (f.artist.length && !t.artists.some(a => f.artist.some(artist => normalize(a.name).includes(normalize(artist))))) return false;
  if (f.theme && !l?.themes.some(x => normalize(x).includes(normalize(f.theme)))) return false;
  if (f.mood && (!l?.mood || !normalize(l.mood).includes(normalize(f.mood)))) return false;
  return true;
}
export function searchCatalog(c: Catalog, query: string, f: Filters, w: Workspace) {
  const q = normalize(query);
  const tracks = c.tracks.filter(t => (!q || normalize(t.title).includes(q) || t.artists.some(a => normalize(a.name).includes(q))) && matchesFilters(t, f, w));
  const score = (t: Track) => normalize(t.title) === q ? 0 : normalize(t.title).startsWith(q) ? 1 : 2;
  tracks.sort((a, b) => score(a) - score(b) || a.title.localeCompare(b.title, 'pt-BR'));
  const artists = q ? c.artists.filter(a => normalize(a.name).includes(q) && tracks.some(t => t.artists.some(x => x.id === a.id))) : [];
  return {tracks, artists};
}
export interface PassageMatch {track: Track; start: number; end: number; text: string; startLine: number; endLine: number}
export function searchPassages(c: Catalog, query: string, f: Filters, w: Workspace): PassageMatch[] {
  const q = normalize(query); const results: PassageMatch[] = [];
  if (!q) return results;
  for (const t of c.tracks) {
    const l = w.lyrics[t.id];
    if (!l || !matchesFilters(t, f, w)) continue;
    let offset = 0; let number = 0;
    const lines = l.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) number++;
      if (normalize(lines[i]).includes(q)) results.push({track: t, start: offset, end: offset + lines[i].length, text: lines[i], startLine: number, endLine: number});
      offset += lines[i].length + 1;
    }
    // A frase pode atravessar uma quebra de linha; o intervalo continua ligado ao texto original.
    if (q.includes(' ') && !results.some(r => r.track.id === t.id)) {
      const folded = normalize(l.text).replace(/\s+/g, ' ');
      if (folded.includes(q)) {
        let cursor = 0;
        for (let i = 0; i < lines.length - 1; i++) {
          const phrase = normalize(lines[i] + ' ' + lines[i + 1]).replace(/\s+/g, ' ');
          if (phrase.includes(q)) {const end = cursor + lines[i].length + 1 + lines[i + 1].length; results.push({track: t, start: cursor, end, text: lines[i] + '\n' + lines[i + 1], startLine: lineAt(l.text, cursor), endLine: lineAt(l.text, end - 1)});}
          cursor += lines[i].length + 1;
        }
      }
    }
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
