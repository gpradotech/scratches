import {SegmentedControl, TextAction, TextLink} from './Controls.tsx';
import {useRef, useState} from 'react';
import type {CSSProperties, ReactNode, RefObject} from 'react';
import type {Artist, Track} from '../domain/model.ts';
import {duration} from '../domain/model.ts';
import {nextTrackSort, sortAnnouncement, sortColumn, sortFromParams, sortingParams, sortLabels, sortTracks, trackListNumber} from '../domain/sorting.ts';
import type {SortColumn, TrackSort} from '../domain/sorting.ts';
import {albumUrl, trackUrl} from '../routing.ts';
import {Cover, Icon} from './UI.tsx';
import {Pagination} from './Pagination.tsx';
import {ColumnResize, useColumnMeasurements} from './ColumnResize.tsx';
import {trackColumnTemplate} from '../domain/columns.ts';
import {catalogViewFromParams, catalogViewParams} from '../domain/catalogView.ts';
import type {CatalogView} from '../domain/catalogView.ts';
import {usePaginationFocus} from '../usePaginationFocus.ts';
import {TrackArtists} from './TrackArtists.tsx';
import {useGalleryPagination} from '../useGalleryPagination.ts';

function SortBar({sort, onChange, onResize, view, compact}: {sort: TrackSort; onChange: (sort: TrackSort) => void; onResize: (widths: number[] | null) => void; view: CatalogView; compact?: boolean}) {
  const bar = useRef<HTMLDivElement>(null);
  const {widths, setWidths} = useColumnMeasurements(bar);
  const columns: SortColumn[] = compact ? ['sequence', 'title', 'bpm', 'duration'] : ['sequence', 'title', 'album', 'bpm', 'duration'];
  return <><div ref={bar} className={'track-sort-bar' + (view === 'gallery' ? ' track-sort-gallery' : '')} role="group" aria-label="Ordenar músicas">{columns.map(column => {
    const active = sortColumn(sort) === column;
    const key = active ? sort!.key : column;
    const next = nextTrackSort(sort, column);
    const numeric = next?.key === 'sequence' || next?.key === 'duration' || next?.key === 'bpm';
    const hint = next ? `Ordenar por ${sortLabels[next.key].toLocaleLowerCase('pt-BR')}: ${numeric ? next.direction === 'asc' ? 'menor para maior' : 'maior para menor' : next.direction === 'asc' ? 'A–Z' : 'Z–A'}` : 'Restaurar ordem padrão';
    return <div className={'track-sort-cell track-column-' + column} key={column}><TextAction type="button" aria-label={'Ordenar por ' + sortLabels[key].toLocaleLowerCase('pt-BR')} aria-pressed={active} title={hint} onClick={() => onChange(next)}>
      {column === 'duration' ? <Icon name="clock" size={18}/> : <span>{column === 'sequence' ? '#' : sortLabels[key]}</span>}
      {active && <Icon name={sort!.direction === 'asc' ? 'caret-up' : 'chevron'} size={14} weight="fill"/>}
    </TextAction>{view === 'list' && column !== 'duration' && <ColumnResize column={column} bar={bar} widths={widths} compact={compact} onResize={nextWidths => {if (nextWidths) setWidths(nextWidths); onResize(nextWidths);}}/>}</div>;
  })}</div><p className="sr-only" role="status" aria-live="polite">{sortAnnouncement(sort)}</p></>;
}
function TrackIdentity({track: t, artistProfiles, collapseArtists = false, actions}: {actions?: ReactNode; track: Track; artistProfiles?: readonly Artist[]; collapseArtists?: boolean}) {
  return <div className="track-identity"><TextLink underline={false} className="track-title" title={t.title} href={trackUrl(t.id)}><span className="track-title-text">{t.title}</span></TextLink>
      <TrackArtists track={t} artistProfiles={artistProfiles} collapsed={collapseArtists}/>{actions}
    </div>;
}
function TrackBpm({track}: {track: Track}) {
  return <span className="track-bpm" aria-label={track.bpm === null ? 'BPM não informado' : `${track.bpm} BPM`} title={track.bpm === null ? 'BPM não informado' : undefined}>{track.bpm === null ? '—' : track.bpm.toLocaleString('pt-BR', {maximumFractionDigits: 1})}</span>;
}
function TrackRow({track: t, artistProfiles, number, compact, actions}: {actions?: ReactNode; track: Track; artistProfiles?: readonly Artist[]; number: number; compact?: boolean}) {
  return <article className="track-row track-item track-surface">
    <span className="track-number" aria-label={'Número ' + number}>{number}</span>{!compact && <Cover track={t}/>}
    <TrackIdentity track={t} artistProfiles={artistProfiles} collapseArtists actions={actions}/>
    {!compact && <TextLink className="track-album" title={t.album} href={albumUrl(t)}>{t.album}</TextLink>}<TrackBpm track={t}/><span className="track-duration">{duration(t.duration)}</span>
  </article>;
}
function TrackGalleryCard({track, artistProfiles, actions}: {actions?: ReactNode; track: Track; artistProfiles?: readonly Artist[]}) {
  return <article className="track-gallery-card track-item track-surface">
    <Cover track={track}/><TrackIdentity track={track} artistProfiles={artistProfiles} collapseArtists actions={actions}/>
    <TextLink className="track-album" title={track.album} href={albumUrl(track)}>{track.album}</TextLink>
    <div className="track-gallery-facts"><span><TrackBpm track={track}/> <span aria-hidden="true">BPM</span></span><span aria-label={'Duração ' + duration(track.duration)}><Icon name="clock" size={14}/>{duration(track.duration)}</span></div>
  </article>;
}
export function TrackList({tracks, artistProfiles, params, onParamsChange, headingRef, heading, fixedView, showViewControls = true, paginate = true, compact = false, toolbarActions, renderActions}: {
  toolbarActions?: ReactNode; renderActions?: (track: Track) => ReactNode; tracks: Track[]; artistProfiles?: readonly Artist[]; params: URLSearchParams; onParamsChange: (params: URLSearchParams) => void;
  headingRef: RefObject<HTMLHeadingElement | null>; heading?: ReactNode; fixedView?: CatalogView; showViewControls?: boolean; paginate?: boolean; compact?: boolean;
}) {
  const sort = sortFromParams(params);
  const view = fixedView ?? catalogViewFromParams(params);
  const [columnWidths, setColumnWidths] = useState<number[] | null>(null);
  const ordered = sortTracks(tracks, sort);
  const {gridRef, paging, pageSizeOptions, pageParams} = useGalleryPagination(ordered.length, params, view === 'gallery' && paginate);
  const focusTracks = usePaginationFocus(headingRef, paging.page, paging.pageSize);
  const start = paginate ? paging.start : 0;
  const end = paginate ? paging.end : ordered.length;
  return <div className="track-collection" data-compact={compact || undefined} style={columnWidths ? {'--track-resized-grid': trackColumnTemplate(columnWidths)} as CSSProperties : undefined}>
    {(heading || showViewControls) && <div className="track-collection-heading">{heading}{showViewControls && <div className="track-view-toolbar">{toolbarActions}<SegmentedControl value={view} label="Visualização do catálogo" onChange={next => {focusTracks.current = false; onParamsChange(catalogViewParams(params, next));}}
      options={[{value: 'list', label: <><Icon name="list" size={18}/>Lista</>}, {value: 'gallery', label: <><Icon name="gallery" size={18}/>Galeria</>}]}/></div>}</div>}
    {tracks.length > 0 && <SortBar sort={sort} view={view} compact={compact} onResize={setColumnWidths} onChange={next => {focusTracks.current = false; onParamsChange(sortingParams(params, next));}}/>}
    <div ref={gridRef} className={view === 'gallery' ? 'track-gallery' : 'track-list'}>{ordered.slice(start, end).map((track, index) => view === 'gallery'
      ? <TrackGalleryCard key={track.id} track={track} artistProfiles={artistProfiles} actions={renderActions?.(track)}/>
      : <TrackRow key={track.id} track={track} artistProfiles={artistProfiles} actions={renderActions?.(track)} compact={compact} number={trackListNumber(start + index, paging.total, sort)}/>)}</div>
    {paginate && tracks.length > 0 && <Pagination key={`${paging.page}-${paging.pageSize}-${paging.total}`} state={paging} pageSizeOptions={pageSizeOptions} onChange={(page, size) => {if (page === paging.page && size === paging.pageSize) return; focusTracks.current = true; onParamsChange(pageParams(page, size));}}/>}
  </div>;
}
