import {ButtonLabel, ButtonLink, SurfaceLink, TextLink} from './Controls.tsx';
import {useMemo, useRef} from 'react';
import type {ReactNode} from 'react';
import type {Catalog, Workspace} from '../domain/model.ts';
import type {Filters} from '../domain/search.ts';
import {hasFieldFilters, searchAll} from '../domain/search.ts';
import {artistUrl, go, trackUrl} from '../routing.ts';
import {Cover, Empty, Icon} from './UI.tsx';
import {FilterPanel} from './Filters.tsx';
import type {FilterChangeOptions} from './Filters.tsx';
import {TrackList} from './TrackList.tsx';
import {ArtistDiscography} from './ArtistDiscography.tsx';
import {SectionTitle} from './SectionTitle.tsx';
export function Explore({catalog, workspace, query, filters, setFilters, search, params}: {catalog: Catalog; workspace: Workspace; query: string; filters: Filters; setFilters: (f: Filters, options?: FilterChangeOptions) => void; search: ReactNode; params: URLSearchParams}) {
  const compactHero = !!query || hasFieldFilters(filters);
  const results = useMemo(() => searchAll(catalog, query, filters, workspace), [catalog, query, filters, workspace]);
  const passages = results.passages;
  const resultCount = results.artists.length + results.tracks.length + passages.length;
  const hasResults = !!(results.artists.length || results.tracks.length || passages.length);
  const lyricCount = Object.keys(workspace.lyrics).length;
  const trackHeading = useRef<HTMLHeadingElement>(null);
  return <>
    <section className={'explore-hero' + (compactHero ? ' compact' : '')}>
      {compactHero ? <div className="results-heading"><h1>{query ? 'Resultados da pesquisa' : 'Resultados da exploração'}</h1>{query && <p className="results-query" title={query}>{resultCount} {resultCount === 1 ? 'resultado' : 'resultados'} para "{query}".</p>}</div> : <><p className="hero-kicker">EXPLORAÇÃO PARA LINHAS DE SCRATCH</p><h1>Que <span className="gradient-text">ideia</span> você quer<br className="desktop-break"/> colocar na linha?</h1><p className="hero-description">Encontre músicas, explore letras e guarde os trechos da sua próxima linha.</p></>}
      {search}
    </section>
    <FilterPanel filters={filters} onChange={setFilters} catalog={catalog} workspace={workspace}/>
      {results.artists.length > 0 && <section className="result-section"><SectionTitle count={results.artists.length}>{results.artists.length === 1 ? 'Artista' : 'Artistas'}</SectionTitle><div className="artist-results">{results.artists.map(a => <SurfaceLink className="artist-result" href={artistUrl(a.id)} key={a.id}>{a.picture ? <img src={a.picture} alt={a.name}/> : <span className="artist-initial">{a.name.slice(0, 1)}</span>}<span><strong>{a.name}</strong><small>Artista</small></span><ButtonLabel>Ver artista <Icon name="arrow"/></ButtonLabel></SurfaceLink>)}</div></section>}
      {results.tracks.length > 0 && <section className="result-section">
      <TrackList tracks={results.tracks} artistProfiles={catalog.artists} params={params} headingRef={trackHeading} onParamsChange={next => go('/explorar', next, {preserveScroll: true})}
        heading={<SectionTitle ref={trackHeading} tabIndex={-1} className="paginated-heading" count={results.tracks.length}>Catálogo</SectionTitle>}/>
      </section>}
    {passages.length > 0 && <section className="result-section"><div className="section-heading"><SectionTitle count={passages.length}>Trechos</SectionTitle></div>
      <div className="passage-results">{passages.map(p => <article className="passage-result" key={p.track.id + ':' + p.start}><Cover track={p.track}/><div><TextLink underline={false} className="track-title" href={trackUrl(p.track.id)}>{p.track.title}</TextLink><p className="metadata">{p.track.artists.map(a => a.name).join(', ')} · Linhas {p.startLine}–{p.endLine}</p><blockquote>{p.text}</blockquote></div><ButtonLink href={trackUrl(p.track.id) + `?inicio=${p.start}&fim=${p.end}&rev=${encodeURIComponent(workspace.lyrics[p.track.id].revision)}`}>Ver na letra <Icon name="arrow" size={17}/></ButtonLink></article>)}</div>
    </section>}
    {!hasResults && (catalog.tracks.length || catalog.artists.length ? <Empty title="Nenhum resultado encontrado"><p>Tente outro título, artista, palavra ou frase, ou ajuste os filtros.</p></Empty> : <Empty title="Seu catálogo está vazio"><p>Esta instalação começa sem músicas e artistas. A inclusão de um catálogo estará disponível em uma próxima versão.</p></Empty>)}
    {catalog.tracks.length > 0 && query.trim() && !passages.length && <p className="caption">{lyricCount ? `Nenhum trecho encontrado ${lyricCount === 1 ? 'na letra adicionada' : `nas ${lyricCount} letras adicionadas`} ao seu acervo.` : 'A busca também encontra trechos nas letras que você adicionar ao seu acervo.'}</p>}
  </>;
}
export function ArtistPage({catalog, id, exploreUrl, params}: {exploreUrl: string; catalog: Catalog; id: string; params: URLSearchParams}) {
  const artist = catalog.artists.find(item => item.id === id);
  if (!artist) return <Empty title="Artista não encontrado" action={<ButtonLink href="#/explorar">Voltar a Explorar</ButtonLink>}/>;
  const available = catalog.tracks.filter(track => track.artists.some(item => item.id === id));
  return <>
    <TextLink className="back-link inline-icon-link" href={exploreUrl}><Icon name="arrow-left" size={16}/>Voltar a Explorar</TextLink>
    <div className="breadcrumb"><TextLink href={exploreUrl}>Explorar</TextLink><span>/</span>{artist.name}</div>
    <section className="artist-hero">{artist.picture ? <img src={artist.picture} alt={artist.name}/> : <span className="artist-initial hero-initial">{artist.name.slice(0, 1)}</span>}<div><p className="eyebrow">ARTISTA</p><h1>{artist.name}</h1><p className="muted">{available.length} {available.length === 1 ? 'música disponível' : 'músicas disponíveis'} no catálogo.</p></div></section>
    <ArtistDiscography catalog={catalog} artistId={id} params={params}/>
  </>;
}
