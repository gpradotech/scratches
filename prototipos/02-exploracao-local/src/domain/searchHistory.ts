import {normalize} from './model.ts';

export interface SearchHistoryEntry {label: string; url: string; type: string}
export const searchHistoryKey = 'scratches.search-history.v1';
export const searchHistoryLimit = 50;
const validEntry = (value: unknown): value is SearchHistoryEntry => {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.label === 'string' && !!item.label.trim() && item.label.length <= 10000
    && typeof item.type === 'string' && !!item.type.trim() && item.type.length <= 100
    && typeof item.url === 'string' && item.url.length <= 60000
    && /^#\/(?:explorar(?:\?[^#]*)?|(?:artista|musica)\/[^?#]+(?:\?[^#]*)?)$/.test(item.url);
};
const identity = (item: SearchHistoryEntry) => item.type === 'Pesquisa' ? 'query:' + normalize(item.label) : 'item:' + item.url;

export function parseSearchHistory(raw: string | null): SearchHistoryEntry[] {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('items' in value) || !Array.isArray(value.items)) return [];
    const seen = new Set<string>();
    return value.items.filter(validEntry).filter(item => {const key = identity(item); if (seen.has(key)) return false; seen.add(key); return true;}).slice(0, searchHistoryLimit).map(({label,url,type}) => ({label,url,type}));
  } catch {return [];}
}
export const serializeSearchHistory = (items: SearchHistoryEntry[]) => JSON.stringify({version: 1, items});
export function addSearchHistory(items: SearchHistoryEntry[], entry: SearchHistoryEntry): SearchHistoryEntry[] {
  if (!validEntry(entry)) return items;
  return [{label:entry.label,url:entry.url,type:entry.type}, ...items.filter(item => identity(item) !== identity(entry))].slice(0, searchHistoryLimit);
}
export const removeSearchHistory = (items: SearchHistoryEntry[], url: string) => items.filter(item => item.url !== url);
