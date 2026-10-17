import {useEffect, useState} from 'react';
import type {Track} from './domain/model.ts';
import {albumId} from './domain/albums.ts';
export const routeUrl = (path: string, params?: URLSearchParams) => '#' + path + (params?.size ? '?' + params.toString() : '');
export const go = (path: string, params?: URLSearchParams, options?: {preserveScroll?: boolean}) => {
  const target = routeUrl(path, params);
  if (location.hash === target) return;
  history.pushState(options?.preserveScroll ? {scratchesScroll: window.scrollY, scratchesScrollHash: target} : null, '', target);
  window.dispatchEvent(new CustomEvent('hashchange', {detail: {scroll: options?.preserveScroll ? window.scrollY : undefined}}));
};
export const trackUrl = (id: string) => routeUrl('/musica/' + encodeURIComponent(id));
export const artistUrl = (id: string) => routeUrl('/artista/' + encodeURIComponent(id));
export const albumUrl = (track: Track) => routeUrl('/album/' + encodeURIComponent(albumId(track)));
export function useRoute() {
  const [hash, setHash] = useState(() => location.hash || '#/explorar');
  useEffect(() => {
    const positions = new Map<string, number>(); let prior = location.hash || '#/explorar';
    const change = (event: Event) => {
      positions.set(prior, window.scrollY);
      prior = location.hash || '#/explorar';
      setHash(prior);
      const requestedScroll = event instanceof CustomEvent ? event.detail?.scroll : undefined;
      // An explicit request uses the current position, even when this URL was visited before.
      const scroll = typeof requestedScroll === 'number' ? requestedScroll
        : positions.get(prior) ?? (history.state?.scratchesScrollHash === prior ? history.state.scratchesScroll : 0);
      requestAnimationFrame(() => window.scrollTo(0, scroll));
    };
    window.addEventListener('hashchange', change); return () => window.removeEventListener('hashchange', change);
  }, []);
  const [path, query = ''] = hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return {page: parts[0] || 'explorar', id: parts[1] ?? '', params: new URLSearchParams(query), hash};
}
