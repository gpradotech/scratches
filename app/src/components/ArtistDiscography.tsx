import {useId, useMemo, useRef} from 'react';
import type {Artist, Catalog} from '../domain/model.ts';
import {duration, normalize} from '../domain/model.ts';
import {artistAlbums, albumSortFromParams, albumSortParams, albumSortLabels, nextAlbumSort, sortAlbums, filterAlbums, releaseFilters, releaseFilterFromParams, releaseFilterParams, releaseTypeLabels} from '../domain/albums.ts';
import type {CatalogAlbum} from '../domain/albums.ts';
import {catalogViewFromParams, catalogViewParams} from '../domain/catalogView.ts';
import {albumUrl, go} from '../routing.ts';
import {usePaginationFocus} from '../usePaginationFocus.ts';
import {SegmentedControl, SurfaceLink, TextAction, TextLink} from './Controls.tsx';
import {AlbumCover} from './AlbumCover.tsx';
import {Empty, Icon} from './UI.tsx';
import {Pagination} from './Pagination.tsx';
import {TrackList} from './TrackList.tsx';
import {TextSelect} from './TextSelect.tsx';
import {useGalleryPagination} from '../useGalleryPagination.ts';
import {SectionTitle} from './SectionTitle.tsx';

const albumHref = (album: CatalogAlbum) => albumUrl(album.tracks[0]);
function AlbumFacts({album, artistId}: {album: CatalogAlbum; artistId: string}) {
  return <><p className="caption album-facts">{album.releaseDate?.slice(0, 4) ?? 'Data não confirmada'} · {album.releaseType ? releaseTypeLabels[album.releaseType] : 'Tipo não informado'} · {album.tracks.length} {album.tracks.length === 1 ? 'música disponível' : 'músicas disponíveis'}</p>
    {album.artist?.id !== artistId && <p className="caption album-participation">Participação · {album.artist?.name}</p>}</>;
}

function AlbumTrackSection({album, artistProfiles, artistId, params, onParamsChange}: {album: CatalogAlbum; artistProfiles: readonly Artist[]; artistId: string; params: URLSearchParams; onParamsChange: (params: URLSearchParams) => void}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  return <section className="artist-album-section" aria-labelledby={headingId}>
    <header className="artist-album-header"><SurfaceLink href={albumHref(album)} className="artist-album-artwork" tabIndex={-1} aria-hidden="true"><AlbumCover album={album} large/></SurfaceLink>
      <div><h3 ref={heading} id={headingId} tabIndex={-1}><TextLink underline={false} className="track-title" href={albumHref(album)}>{album.title}</TextLink></h3>
        <AlbumFacts album={album} artistId={artistId}/><p className="caption">{duration(album.duration)} disponíveis no catálogo</p>
        <TextLink className="inline-icon-link artist-album-open" size="sm" href={albumHref(album)}>{album.releaseType === 'album' ? 'Ver álbum' : 'Ver lançamento'} <Icon name="arrow" size={16}/></TextLink>
      </div>
    </header>
    <TrackList tracks={album.tracks} artistProfiles={artistProfiles} params={params} headingRef={heading} onParamsChange={onParamsChange} fixedView="list" showViewControls={false} paginate={false} compact/>
  </section>;
}

export function ArtistDiscography({catalog, artistId, params}: {catalog: Catalog; artistId: string; params: URLSearchParams}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const albums = useMemo(() => artistAlbums(catalog, artistId), [catalog, artistId]);
  const legacyFilter = params.get('album') ?? '';
  const releaseFilter = releaseFilterFromParams(params);
  const filtered = filterAlbums(albums, releaseFilter);
  const available = legacyFilter ? filtered.filter(album => normalize(album.title) === normalize(legacyFilter)) : filtered;
  const sort = albumSortFromParams(params);
  const view = catalogViewFromParams(params, 'gallery');
  const ordered = sortAlbums(available, sort);
  const {gridRef, paging, pageSizeOptions, pageParams} = useGalleryPagination(ordered.length, params, view === 'gallery');
  const focusAlbums = usePaginationFocus(heading, paging.page, paging.pageSize);
  const visible = ordered.slice(paging.start, paging.end);
  const change = (next: URLSearchParams) => go('/artista/' + encodeURIComponent(artistId), next, {preserveScroll: true});
  const changeTracks = (next: URLSearchParams) => {const page = params.get('pagina'); if (page) next.set('pagina', page); change(next);};
  return <section className="artist-discography" aria-labelledby="artist-albums-heading">
    <div className="artist-album-toolbar"><SectionTitle id="artist-albums-heading" ref={heading} tabIndex={-1} count={available.length}>Discografia</SectionTitle>
      <div className="artist-album-controls"><div className="artist-album-order" role="group" aria-label="Filtrar e ordenar lançamentos">
        <TextSelect label="Tipo de lançamento" value={releaseFilter} options={releaseFilters}
          onChange={next => {focusAlbums.current = false; change(releaseFilterParams(params, next));}}/>
        <TextAction aria-label={'Ordenação: ' + albumSortLabels[sort]} title={'Próxima ordenação: ' + albumSortLabels[nextAlbumSort(sort)]}
          onClick={() => {focusAlbums.current = false; change(albumSortParams(params, nextAlbumSort(sort)));}}>
          {sort === 'recent' || sort === 'oldest' ? 'Data de lançamento' : 'Título'}<Icon name={sort === 'recent' || sort === 'title-desc' ? 'chevron' : 'caret-up'} weight="fill" size={14}/></TextAction>
      </div><SegmentedControl value={view} label="Visualização da discografia" onChange={next => {focusAlbums.current = false; change(catalogViewParams(params, next, 'gallery'));}}
        options={[{value: 'list', label: <><Icon name="list" size={18}/>Lista</>}, {value: 'gallery', label: <><Icon name="gallery" size={18}/>Galeria</>}]}/></div>
    </div>
    {legacyFilter && <p className="caption artist-album-filter">Exibindo “{legacyFilter}”. <TextAction onClick={() => {const next = new URLSearchParams(params); next.delete('album'); next.delete('pagina'); change(next);}}>Mostrar todos os álbuns</TextAction></p>}
    <p className="sr-only" role="status" aria-live="polite">{albumSortLabels[sort]}. {available.length} lançamentos encontrados.</p>
    {!visible.length ? <Empty title="Nenhum lançamento encontrado"><p>Não há lançamentos com tipo confirmado nessa seleção do catálogo.</p></Empty> : <>
      {view === 'gallery' ? <div ref={gridRef} className="track-gallery artist-album-gallery">{visible.map(album => <article key={album.id} className="track-gallery-card track-item track-surface artist-album-card">
        <AlbumCover album={album}/><TextLink underline={false} className="track-title" title={album.title} href={albumHref(album)}><span className="track-title-text">{album.title}</span></TextLink>
        <AlbumFacts album={album} artistId={artistId}/>
      </article>)}</div> : <div className="artist-albums-list">{visible.map(album => <AlbumTrackSection key={album.id} album={album} artistProfiles={catalog.artists} artistId={artistId} params={params} onParamsChange={changeTracks}/>)}</div>}
      <Pagination key={`${paging.page}-${paging.pageSize}-${paging.total}`} kind="releases" state={paging} pageSizeOptions={pageSizeOptions} onChange={(page, size) => {if (page === paging.page && size === paging.pageSize) return; focusAlbums.current = true; change(pageParams(page, size));}}/>
    </>}
  </section>;
}
