import {ButtonLink, TextLink} from './Controls.tsx';
import {useRef} from 'react';
import type {Catalog} from '../domain/model.ts';
import {duration} from '../domain/model.ts';
import {findAlbum, releaseTypeLabels} from '../domain/albums.ts';
import {artistUrl, go} from '../routing.ts';
import {Empty, Icon} from './UI.tsx';
import {AlbumCover} from './AlbumCover.tsx';
import {TrackList} from './TrackList.tsx';
import {SectionTitle} from './SectionTitle.tsx';

export function AlbumPage({catalog, id, exploreUrl, params}: {catalog: Catalog; id: string; exploreUrl: string; params: URLSearchParams}) {
  const album = findAlbum(catalog, id);
  const heading = useRef<HTMLHeadingElement>(null);
  if (!album) return <Empty title="Álbum não encontrado" action={<ButtonLink href={exploreUrl}>Voltar a Explorar</ButtonLink>}/>;
  return <>
    <TextLink className="back-link inline-icon-link" href={exploreUrl}><Icon name="arrow-left" size={16}/>Voltar a Explorar</TextLink>
    <div className="breadcrumb"><TextLink href={exploreUrl}>Explorar</TextLink><span>/</span>{album.artist && <><TextLink href={artistUrl(album.artist.id)}>{album.artist.name}</TextLink><span>/</span></>}<span>{album.title}</span></div>
    <section className="album-hero">
      <AlbumCover album={album} large/>
      <div><p className="eyebrow">{album.releaseType ? releaseTypeLabels[album.releaseType].toLocaleUpperCase('pt-BR') : 'LANÇAMENTO'}</p><h1>{album.title}</h1><p className="metadata">{album.artist && <TextLink href={artistUrl(album.artist.id)}>{album.artist.name}</TextLink>}</p><p className="muted">{album.tracks.length} {album.tracks.length === 1 ? 'música disponível' : 'músicas disponíveis'} no catálogo · {duration(album.duration)}</p></div>
    </section>
    <section className="result-section"><div className="section-heading"><SectionTitle ref={heading} tabIndex={-1} className="paginated-heading" count={album.tracks.length}>Músicas</SectionTitle></div>
      <TrackList tracks={album.tracks} params={params} headingRef={heading} fixedView="list" showViewControls={false} onParamsChange={next => go('/album/' + encodeURIComponent(id), next, {preserveScroll: true})}/>
    </section>
  </>;
}
