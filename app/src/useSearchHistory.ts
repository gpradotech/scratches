import {useCallback, useEffect, useRef, useState} from 'react';
import {addSearchHistory, parseSearchHistory, removeSearchHistory, searchHistoryKey, serializeSearchHistory} from './domain/searchHistory.ts';
import type {SearchHistoryEntry} from './domain/searchHistory.ts';

function readHistory(fallback: SearchHistoryEntry[] = []) {
  try {return parseSearchHistory(localStorage.getItem(searchHistoryKey));} catch {return fallback;}
}
export function useSearchHistory() {
  const [items, setItems] = useState(() => readHistory());
  const current = useRef(items);
  const memoryOnly = useRef(false);
  const update = useCallback((change: (items: SearchHistoryEntry[]) => SearchHistoryEntry[]) => {
    const next = change(memoryOnly.current ? current.current : readHistory(current.current));
    try {localStorage.setItem(searchHistoryKey, serializeSearchHistory(next)); memoryOnly.current = false;} catch {memoryOnly.current = true;}
    current.current = next;
    setItems(next);
  }, []);
  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key !== searchHistoryKey && event.key !== null) return;
      const next = readHistory(); current.current = next; setItems(next);
    };
    window.addEventListener('storage', synchronize);
    return () => window.removeEventListener('storage', synchronize);
  }, []);
  const add = useCallback((entry: SearchHistoryEntry) => update(items => addSearchHistory(items, entry)), [update]);
  const remove = useCallback((url: string) => update(items => removeSearchHistory(items, url)), [update]);
  const clear = useCallback(() => update(() => []), [update]);
  return {items, add, remove, clear};
}
