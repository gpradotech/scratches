import {normalize} from './model.ts';

export type SearchField = 'any' | 'intitle' | 'inlyric' | 'album' | 'artist';
export interface SearchTerm {field: SearchField; value: string; exact: boolean; exclude: boolean}
export interface SearchQuery {groups: SearchTerm[][]; legacy: boolean; error?: string}
const fold = (text: string) => normalize(text).replace(/\s+/g, ' ');
const fields = /^(intitle|inlyric|album|artist):/i;

// OR separates groups; every term within a group is required (AND).
export function parseSearchQuery(input: string): SearchQuery {
  const source = input.trim().replace(/[“”]/g, '"');
  if (!source) return {groups: [], legacy: true};
  const advanced = /"|(?:^|\s)(?:AND|OR)(?=\s|$)|(?:^|\s)-/.test(source) || /(?:^|\s)(?:intitle|inlyric|album|artist):/i.test(source);
  // Ordinary searches retain their existing substring / phrase behavior.
  if (!advanced) return {groups: [[{field:'any', value:fold(source), exact:false, exclude:false}]], legacy:true};
  const groups: SearchTerm[][] = [[]]; let cursor = 0; let needTerm = true;
  const invalid = (error: string): SearchQuery => ({groups:[], legacy:false, error});
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '') && cursor < source.length) cursor++;
    if (cursor >= source.length) break;
    const operator = source.slice(cursor).match(/^(AND|OR)(?=\s|$)/);
    if (operator) {
      if (needTerm) return invalid('Informe um termo antes de ' + operator[1] + '.');
      if (operator[1] === 'OR') groups.push([]);
      cursor += operator[1].length; needTerm = true; continue;
    }
    let exclude = false;
    if (source[cursor] === '-') {exclude = true; cursor++; while (cursor < source.length && /\s/.test(source[cursor])) cursor++;}
    const prefix = source.slice(cursor).match(fields);
    const field: SearchField = prefix ? prefix[1].toLowerCase() as SearchField : 'any';
    if (prefix) {cursor += prefix[0].length; while (cursor < source.length && /\s/.test(source[cursor])) cursor++;}
    const exact = source[cursor] === '"'; let value = '';
    if (exact) {
      cursor++; let closed = false;
      while (cursor < source.length) {
        const char = source[cursor++];
        if (char === '"') {closed = true; break;}
        if (char === '\\' && ['"','\\'].includes(source[cursor] ?? '')) value += source[cursor++]; else value += char;
      }
      if (!closed) return invalid('Feche as aspas para pesquisar a frase exata.');
      if (cursor < source.length && !/\s/.test(source[cursor])) return invalid('Separe os termos de busca com um espaço.');
    } else {while (cursor < source.length && !/\s/.test(source[cursor])) value += source[cursor++];}
    value = fold(value);
    if (!value || !exact && /^(AND|OR)$/.test(value.toUpperCase()) && (prefix || exclude)) return invalid('Informe o termo depois de ' + (prefix?.[0] ?? '-') + '.');
    groups[groups.length - 1].push({field, value, exact, exclude}); needTerm = false;
  }
  if (needTerm) return invalid('Complete a pesquisa com um termo depois do operador.');
  return {groups, legacy:false};
}
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function termPattern(term: SearchTerm) {
  return new RegExp((term.exact ? '(?<![\\p{L}\\p{N}])' : '') + escape(term.value) + (term.exact ? '(?![\\p{L}\\p{N}])' : ''), 'gu');
}
export function termMatches(text: string, term: SearchTerm) {return termPattern(term).test(fold(text));}
export interface SearchDocument {intitle: string; artist: string[]; album: string; inlyric: string}
export function evaluateQuery(query: SearchQuery, document: SearchDocument, target: 'catalog' | 'passages') {
  if (query.error) return {matches:false, lyricTerms:[]};
  if (!query.groups.length) return {matches:true, lyricTerms:[]};
  const lyricTerms = new Set<SearchTerm>(); let matches = false;
  for (const group of query.groups) {
    const evidence: SearchTerm[] = [];
    const passed = group.every(term => {
      let lyricFound: boolean | undefined;
      const matchesValue = (value: string) => value === document.inlyric ? (lyricFound ??= termMatches(value, term)) : termMatches(value, term);
      const values = term.field === 'any'
        ? (target === 'passages' && query.legacy ? [document.inlyric]
          : [document.intitle, ...document.artist, ...(term.exclude ? [document.album] : []), ...(target === 'passages' || term.exclude ? [document.inlyric] : [])])
        : term.field === 'artist' ? document.artist : [document[term.field]];
      const found = values.some(matchesValue);
      if (target === 'passages' && found && !term.exclude && (term.field === 'any' || term.field === 'inlyric') && matchesValue(document.inlyric)) evidence.push(term);
      return term.exclude ? !found : found;
    });
    if (passed) {matches = true; for (const term of evidence) lyricTerms.add(term);}
  }
  return {matches, lyricTerms:[...lyricTerms]};
}

// Map folded characters back to original UTF-16 offsets, including accents,
// emoji and collapsed whitespace. Never use normalized offsets for navigation.
export function foldedOffsets(text: string) {
  let value = ''; const starts: number[] = [], ends: number[] = []; let offset = 0;
  for (const char of text) {
    const normalized = char.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR');
    for (const part of normalized) {
      if (/\s/u.test(part)) {
        if (value.endsWith(' ')) ends[ends.length - 1] = offset + char.length;
        else {value += ' '; starts.push(offset); ends.push(offset + char.length);}
      } else {
        value += part;
        for (let i = 0; i < part.length; i++) {starts.push(offset); ends.push(offset + char.length);}
      }
    }
    // A separately encoded accent still belongs to the preceding character.
    if (!normalized && ends.length) ends[ends.length - 1] = offset + char.length;
    offset += char.length;
  }
  return {value, starts, ends};
}
