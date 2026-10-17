import {IconButton, TextAction} from './Controls.tsx';
import {useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useSearchDock} from '../useSearchDock.ts';
import type {SearchDock} from '../domain/searchDock.ts';
import type {Catalog, Workspace} from '../domain/model.ts';
import {normalize} from '../domain/model.ts';
import {filtersFromParams, searchAll} from '../domain/search.ts';
import {artistUrl, go, routeUrl, trackUrl} from '../routing.ts';
import type {SearchHistoryEntry} from '../domain/searchHistory.ts';
import {Icon} from './UI.tsx';

interface SearchMedia {kind: 'artist' | 'track'; src: string | null; label: string}
interface SearchOption extends SearchHistoryEntry {media?: SearchMedia; execute: () => void}

function SuggestionArtwork({media}: {media: SearchMedia}) {
  const [failed, setFailed] = useState(false);
  return <span className={'command-media command-media-' + media.kind} aria-hidden="true">
    {media.src && !failed ? <img src={media.src} alt="" onError={() => setFailed(true)}/>
      : media.kind === 'artist' ? media.label.slice(0, 1) : '?'}
  </span>;
}

export function Search({catalog, workspace, initial, recent, searchParams, focusRequest, onFocusHandled, onRecent, onRemoveRecent, onClearRecent, onDockChange}: {
  catalog: Catalog; workspace: Workspace; initial: string; recent: SearchHistoryEntry[];
  searchParams: string; focusRequest: number; onFocusHandled: () => void; onRecent: (r: SearchHistoryEntry) => void;
  onRemoveRecent: (url: string) => void; onClearRecent: () => void;
  onDockChange: (dock: SearchDock) => void;
}) {
  const [query, setQuery] = useState(initial);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [availableHeight, setAvailableHeight] = useState(360);
  const input = useRef<HTMLInputElement>(null);
  const module = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const placement = useSearchDock(slot, module);
  const dock = placement?.dock ?? null;
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const optionsId = id + '-options';

  useEffect(() => {setQuery(initial); setActive(0);}, [initial]);

  useLayoutEffect(() => {onDockChange(dock);}, [dock, onDockChange]);
  useEffect(() => () => onDockChange(null), [onDockChange]);

  const showSuggestions = useCallback(() => {
    setOpen(true);
    const rect = module.current?.getBoundingClientRect();
    if (rect && window.innerHeight - rect.bottom < 240) {
      slot.current?.scrollIntoView({block: 'start'});
    }
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    input.current?.focus();
    input.current?.select();
    showSuggestions();
    onFocusHandled();
  }, [focusRequest, onFocusHandled, showSuggestions]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !module.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const bottom = module.current?.getBoundingClientRect().bottom ?? 0;
      setAvailableHeight(Math.max(130, Math.min(440, window.innerHeight - bottom - 100)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (module.current) observer.observe(module.current);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, {passive: true});
    return () => {observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure);};
  }, [open, placement?.top, placement?.width]);

  const submit = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    if (query.trim()) params.set('q', query.trim()); else params.delete('q');
    params.delete('modo');
    params.delete('pagina');
    if (query.trim()) onRecent({label: query.trim(), type: 'Pesquisa', url: routeUrl('/explorar', params)});
    go('/explorar', params);
    setOpen(false);
  }, [searchParams, query, onRecent]);

  const mediaByUrl = useMemo(() => {
    const media = new Map<string, SearchMedia>();
    for (const artist of catalog.artists) media.set(artistUrl(artist.id), {kind: 'artist', src: artist.picture, label: artist.name});
    for (const track of catalog.tracks) media.set(trackUrl(track.id), {kind: 'track', src: track.cover, label: track.title});
    return media;
  }, [catalog]);

  const results = useMemo<SearchOption[]>(() => {
    if (!normalize(query)) return recent.map(r => ({...r, media: mediaByUrl.get(r.url.split('?')[0]), execute: () => {location.hash = r.url;}}));
    const params = new URLSearchParams(searchParams);
    const found = searchAll(catalog, query, filtersFromParams(params), workspace);
    const submitResult = {
      label: `Pesquisar por “${query.trim()}”`, type: 'Todos os resultados', url: '',
      execute: submit,
    };
    const artists = found.artists.slice(0, 3).map(a => ({label: a.name, type: 'Artista', url: artistUrl(a.id), media: mediaByUrl.get(artistUrl(a.id)), execute: () => {location.hash = artistUrl(a.id);}}));
    const tracks = found.tracks.slice(0, 5).map(t => ({label: t.title + ' · ' + t.artists[0].name, type: workspace.lyrics[t.id] ? 'Música · letra adicionada' : 'Música', url: trackUrl(t.id), media: mediaByUrl.get(trackUrl(t.id)), execute: () => {location.hash = trackUrl(t.id);}}));
    const passages = found.passages.slice(0, 4).map(p => {
      const url = trackUrl(p.track.id) + `?inicio=${p.start}&fim=${p.end}&rev=${encodeURIComponent(workspace.lyrics[p.track.id].revision)}`;
      return {label: p.track.title + ' · ' + (p.text.length > 100 ? p.text.slice(0, 100) + '…' : p.text), type: 'Trecho · ' + p.track.artists[0].name, url, media: mediaByUrl.get(trackUrl(p.track.id)), execute: () => {location.hash = url;}};
    });
    return [submitResult, ...artists, ...tracks, ...passages];
  }, [catalog, workspace, query, recent, searchParams, mediaByUrl, submit]);

  const activeIndex = Math.min(active, results.length - 1);
  const showingHistory = !normalize(query);
  function select(index: number) {
    const item = results[index];
    if (!item) {submit(); return;}
    if (showingHistory && item.type === 'Pesquisa') setQuery(item.label);
    item.execute();
    if (item.url) onRecent({label: item.label, type: item.type, url: item.url});
    setOpen(false);
  }
  function confirm() {
    if (open && results.length) select(activeIndex); else submit();
  }
  function navigate(direction: number) {
    const next = !open ? 0 : results.length ? (activeIndex + direction + results.length) % results.length : 0;
    setActive(next); showSuggestions();
    requestAnimationFrame(() => list.current?.querySelectorAll('[data-search-option]')[next]?.scrollIntoView({block: 'nearest'}));
  }

  return <><div className={'search-slot' + (dock ? ' is-docked' : '')} ref={slot}/>{createPortal(<div className={'search-module' + (dock ? ' search-module-docked' : '')} style={placement ? {left:placement.left,top:placement.top,width:placement.width,position:dock ? 'fixed' : 'absolute'} : {visibility:'hidden'}} ref={module} onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  }}>
    <div className={'search-opener search-field' + (open ? ' is-open' : '')} onClick={() => {input.current?.focus(); showSuggestions();}}>
      <Icon name="search" size={26}/>
      <input ref={input} aria-label="Pesquisar músicas, artistas ou fragmentos" role="combobox"
        aria-expanded={open} aria-haspopup={showingHistory ? 'grid' : 'listbox'} aria-controls={open ? optionsId : undefined}
        aria-autocomplete="list" aria-activedescendant={open && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        placeholder="Buscar músicas, artistas ou fragmentos" value={query}
        onFocus={showSuggestions} onClick={showSuggestions}
        onChange={e => {setQuery(e.target.value); setActive(0); showSuggestions();}}
        onKeyDown={e => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {e.preventDefault(); navigate(e.key === 'ArrowDown' ? 1 : -1);}
          if (e.key === 'Enter') {e.preventDefault(); confirm();}
          if (e.key === 'Escape') {e.preventDefault(); e.stopPropagation(); setOpen(false);}
        }}/>
      {query.length > 0 ? <div className="search-actions">
        <IconButton variant="plain" type="button" aria-label="Limpar pesquisa" title="Limpar pesquisa"
          onMouseDown={e => e.preventDefault()}
          onClick={e => {e.stopPropagation(); setQuery(''); setActive(0); input.current?.focus(); showSuggestions();}}><Icon name="close"/></IconButton>
        <IconButton variant="primary" type="button" className="search-confirm" aria-label="Confirmar pesquisa" title="Confirmar pesquisa (Enter)"
          onMouseDown={e => e.preventDefault()}
          onClick={e => {e.stopPropagation(); confirm();}}><Icon name="arrow" size={24}/></IconButton>
      </div> : <kbd>Ctrl + K</kbd>}
    </div>
    {open && <section className="search-dropdown" aria-label="Sugestões da pesquisa">
      {showingHistory && <div className="command-history-heading"><p className="command-label">Histórico de pesquisas</p>{recent.length > 0 && <TextAction type="button" className="text-button" aria-label="Limpar histórico de pesquisas" onMouseDown={e => e.preventDefault()} onClick={() => {onClearRecent(); setActive(0); input.current?.focus();}}>Limpar histórico</TextAction>}</div>}
      <div id={optionsId} ref={list} role={showingHistory ? 'grid' : 'listbox'} tabIndex={-1} aria-label={showingHistory ? 'Histórico de pesquisas' : 'Resultados da pesquisa'} className="command-list" style={{maxHeight: availableHeight}}>
        {results.map((r, i) => {
          const option = <button id={`${id}-option-${i}`} data-search-option="true" role={showingHistory ? undefined : 'option'} aria-selected={showingHistory ? undefined : i === activeIndex}
          className={'command-option' + (i === activeIndex ? ' active' : '')} tabIndex={-1} key={r.url || 'submit'}
          onMouseDown={e => e.preventDefault()} onMouseMove={() => setActive(i)} onClick={() => select(i)}>
          {r.media ? <SuggestionArtwork key={r.media.src ?? r.media.label} media={r.media}/>
            : <span className="command-media command-media-search" aria-hidden="true"><Icon name={showingHistory ? 'clock' : 'search'} size={22}/></span>}
          <span>{r.label}<small>{r.type}</small></span>{!showingHistory && <Icon name="arrow" size={16}/>}
        </button>;
          return showingHistory ? <div role="row" aria-selected={i === activeIndex} className="command-history-row" key={r.url}>
            <div role="gridcell" className="command-history-main">{option}</div><div role="gridcell"><IconButton variant="plain" tone="danger" type="button" className="history-remove" aria-label={'Remover ' + r.label + ' (' + r.type + ') do histórico'} title="Remover do histórico"
              onMouseDown={event => event.preventDefault()} onClick={() => {onRemoveRecent(r.url); setActive(Math.max(0, Math.min(activeIndex, results.length - 2))); input.current?.focus();}}><Icon name="close" size={18}/></IconButton></div>
          </div> : option;
        })}
      </div>
      {showingHistory && !recent.length && <p className="command-history-empty" role="status">Suas pesquisas recentes aparecerão aqui.</p>}
      <div className="command-help">{results.length > 0 && <><span><kbd aria-label="Seta para cima"><Icon name="arrow-up" size={12}/></kbd><kbd aria-label="Seta para baixo"><Icon name="arrow-down" size={12}/></kbd> navegar</span><span><kbd>Enter</kbd> abrir</span></>}<span><kbd>Esc</kbd> recolher</span></div>
    </section>}
  </div>,document.body)}</>;
}
