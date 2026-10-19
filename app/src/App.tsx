import {Button, ButtonLink, SurfaceLink, TextAction, TextLink} from './components/Controls.tsx';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {Catalog, Fragment, Track} from './domain/model.ts';
import {canDeleteGeneralTrack, mergeCatalog} from './domain/library.ts';
import {DeleteTrackDialog} from './components/DeleteTrackDialog.tsx';
import {CatalogTrackActions} from './components/CatalogTrackActions.tsx';
import {TrackEditor} from './components/TrackEditor.tsx';
import {filtersFromParams, filtersToParams} from './domain/search.ts';
import {go, useRoute} from './routing.ts';
import {useWorkspace} from './useWorkspace.ts';
import {useLyricsSync} from './useLyricsSync.ts';
import {Dialog, Empty, Icon} from './components/UI.tsx';
import {Explore, ArtistPage} from './components/CatalogViews.tsx';
import {AlbumPage} from './components/Album.tsx';
import {findAlbum} from './domain/albums.ts';
import {Song} from './components/Song.tsx';
import {Projects} from './components/Projects.tsx';
import {Search} from './components/Search.tsx';
import {useSearchHistory} from './useSearchHistory.ts';
import type {SearchDock} from './domain/searchDock.ts';
import {LocalSpace} from './components/LocalSpace.tsx';
import {BackToTop} from './components/BackToTop.tsx';
import {Updates} from './components/Updates.tsx';
import {Toast} from './components/Toast.tsx';
import {FeedbackDialog, emptyFeedbackDraft} from './components/FeedbackDialog.tsx';
import type {Notify, ToastMessage} from './components/Toast.tsx';
const footerContent: Record<string, {title: string; body: string}> = {
  Sobre: {title: 'Pesquisa para suas linhas de scratch', body: 'Scratches ajuda DJs a encontrar referências para criar linhas de scratch. Pesquise músicas, artistas e trechos, explore letras e reúna suas seleções em projetos.\n\nSeus projetos organizam as ideias que você quer levar para os discos: palavras, versos e fragmentos de diferentes músicas, salvos no seu computador.'},
  Ajuda: {title: 'Da pesquisa ao projeto', body: 'Use Adicionar música em Explorar para buscar os metadados ou cadastrar uma faixa manualmente. Na página da música, Complementar metadados permite preencher informações ausentes. Dados importados ficam protegidos; seus complementos são identificados como registros manuais. Músicas cadastradas manualmente permitem editar os dados.\n\nPesquise um título, artista, palavra ou frase. Use os filtros para refinar os resultados. Ctrl + K abre a pesquisa; no Mac, use Cmd + K.\n\nAs letras são buscadas automaticamente via LRCLIB e ficam pesquisáveis nesta instalação. A cobertura e o andamento aparecem na aplicação. Abra uma música com letra disponível. Selecione palavras com o mouse e clique em Adicionar seleção. Você também pode clicar nos números das linhas para selecionar versos; Shift + clique seleciona um intervalo.\n\nSalve os trechos em um projeto existente ou crie um novo. No projeto, alterne entre Por música e Por trechos para revisar suas referências.\n\nEm Espaço local, exporte um backup para guardar seus dados ou restaurá-los em outro computador.'},
  'Fontes e créditos': {title: 'Fontes e créditos', body: 'Metadados, capas e retratos de artistas: Deezer ou Apple (iTunes), conforme a fonte consultada.\nBPM e tonalidade: fontes identificadas em cada registro, incluindo Deezer e ReccoBeats quando disponíveis.\nLetras automáticas: LRCLIB. Referências externas de letras também podem incluir Vagalume.\n\nOs dados recebidos dos serviços são preservados. Informações que você acrescentar aos campos ausentes aparecem como registros manuais e não como dados fornecidos por esses serviços.\n\nConsulte os links em Informações da música e fontes para verificar a origem dos dados de cada faixa. As letras que você adicionar ficam associadas à origem ou referência que informar.'},
  'Enviar feedback': {title: 'Enviar feedback', body: 'Encontrou um problema ou tem uma sugestão? Conte o que aconteceu e o que você gostaria de melhorar. Para relatar um problema, inclua a tela, os passos que seguiu e o resultado esperado.'},
  Privacidade: {title: 'Dados no seu computador', body: 'Suas músicas adicionadas, projetos e letras são armazenados neste computador. A aplicação não envia esse conteúdo a serviços externos.\n\nAbas e janelas da aplicação compartilham o mesmo espaço. Pessoas com acesso aos arquivos no computador também podem acessar esses dados.\n\nA busca automática de letras envia título, artista, álbum e duração ao LRCLIB. As letras obtidas e sua referência ficam salvas localmente. Ao buscar metadados, o título e o artista informados são enviados ao Deezer ou à Apple (iTunes). Projetos e letras não são enviados nessas consultas. As imagens das fontes são consultadas nos endereços de origem e, quando disponíveis no cadastro, ficam salvas no espaço local.\n\nLinks de referência abrem sites externos, sujeitos às suas próprias políticas de privacidade. O formulário de feedback envia somente os campos que você preencher, sem incluir seus projetos, letras ou arquivos. O e-mail de resposta é opcional.\n\nExporte backups em Espaço local para manter uma cópia dos seus projetos e letras.'},
  Termos: {title: 'Termos de uso', body: 'Scratches auxilia a pesquisa e a organização de referências para linhas de scratch. A criação, gravação e edição de áudio são realizadas nas ferramentas que você escolher.\n\nA disponibilidade das informações depende das fontes do catálogo e dos dados que você adicionar. Consulte as fontes de cada música para conferir seus metadados.\n\nMantenha uma cópia dos seus dados exportando backups em Espaço local. Restaurar um backup substitui as músicas adicionadas ou editadas, os projetos e as letras presentes na aplicação.'},
};
export default function App() {
  const route = useRoute(); const local = useWorkspace(); const [baseCatalog, setCatalog] = useState<Catalog>(); const [catalogError, setCatalogError] = useState('');
  const catalog = useMemo(() => baseCatalog ? mergeCatalog(baseCatalog, local.workspace) : undefined, [baseCatalog, local.workspace]);
  useLyricsSync(catalog?.tracks.length ?? 0, local.refresh);
  const [deletingTrack, setDeletingTrack] = useState<Track>();
  const [trackEditor, setTrackEditor] = useState<Track | 'new'>();
  const [searchFocus, setSearchFocus] = useState(0); const [space, setSpace] = useState(false); const [footer, setFooter] = useState(''); const [toast, setToast] = useState<ToastMessage>();
  const [feedbackDraft, setFeedbackDraft] = useState(emptyFeedbackDraft);
  const [lastExplore, setLastExplore] = useState("#/explorar");
  const [searchDocked, setSearchDocked] = useState<SearchDock>(null);
  useEffect(() => {if (route.page === "explorar") setLastExplore(route.hash);}, [route.page, route.hash]);
  const searchHistory = useSearchHistory(); const [drafts, setDrafts] = useState<Record<string, Fragment[]>>({});
  const query = route.params.get('q') ?? '';
  const filters = filtersFromParams(route.params);
  const notify: Notify = useCallback((message, action) => setToast({id: crypto.randomUUID(), message, action}), []);
  const closeToast = useCallback(() => setToast(undefined), []);
  const acknowledgeSearchFocus = useCallback(() => setSearchFocus(0), []);
  useEffect(() => {const controller = new AbortController(); fetch('/catalogo/catalogo.json', {signal: controller.signal}).then(r => {if (!r.ok) throw new Error('Não foi possível carregar o catálogo. Reabra a aplicação e tente novamente.'); return r.json();}).then(setCatalog).catch(e => {if (e.name !== 'AbortError') setCatalogError('Não foi possível carregar o catálogo. Reabra a aplicação e tente novamente.');}); return () => controller.abort();}, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (document.querySelector('dialog[open]')) return;
        if (route.page !== 'explorar') go('/explorar', new URLSearchParams(lastExplore.split('?')[1] ?? ''));
        setSearchFocus(value => value + 1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [route.page, lastExplore]);
  useEffect(() => {const album = route.page === 'album' && catalog ? findAlbum(catalog, route.id) : undefined; document.title = `${album?.title ?? (route.page === 'projetos' || route.page === 'projeto' ? 'Projetos' : 'Explorar')} · Scratches`;}, [route.page, route.id, catalog]);
  const projectPage = route.page === 'projeto' || route.page === 'projetos';
  const ready = catalog && !local.loading;
  const exploreUrl = route.page === "explorar" ? route.hash : lastExplore;
  const song = catalog?.tracks.find(track => track.id === route.id);
  const renderActions = (track: Track) => <CatalogTrackActions track={track}
    canDelete={!!baseCatalog && canDeleteGeneralTrack(local.workspace, baseCatalog, track.id)}
    disabled={local.saving} onDelete={setDeletingTrack}/>;
  const search = catalog ? <Search onDockChange={setSearchDocked} catalog={catalog} workspace={local.workspace} initial={query}
    searchParams={exploreUrl.split('?')[1] ?? ''} focusRequest={searchFocus} onFocusHandled={acknowledgeSearchFocus} recent={searchHistory.items}
    onRecent={searchHistory.add} onRemoveRecent={searchHistory.remove} onClearRecent={searchHistory.clear}/> : null;
  return <div className="app-shell"><a className="skip-link" href="#main-content" onClick={e => {e.preventDefault(); document.getElementById('main-content')?.focus();}}>Pular para o conteúdo</a>
    <header className={'app-header' + (searchDocked ? ' has-docked-search' : '') + (searchDocked === 'stacked' ? ' has-search-row' : '')}><SurfaceLink className="brand" href="#/explorar"><img src="/marca.svg" alt=""/>scratches</SurfaceLink><nav aria-label="Navegação principal"><TextLink underline={false} className={!projectPage ? 'active' : ''} aria-current={!projectPage ? 'page' : undefined} href={exploreUrl}>Explorar</TextLink><TextLink underline={false} className={projectPage ? 'active' : ''} aria-current={projectPage ? 'page' : undefined} href="#/projetos">Projetos</TextLink></nav><Button className="local-space-button" aria-label="Abrir espaço local" onClick={() => setSpace(true)} disabled={!local.loaded}><Icon name="monitor" size={17}/><span>{local.saving ? 'Salvando…' : 'Espaço local'}</span></Button></header>
    {local.error && <div className="workspace-error" role="alert"><span>{local.error} Sua seleção continua nesta janela.</span><Button className="small" onClick={() => void local.reload()} disabled={local.saving}>Recarregar dados</Button></div>}
    <main id="main-content" tabIndex={-1} className="main-content">
      {catalogError ? <Empty title="Não foi possível abrir o catálogo"><p>{catalogError}</p></Empty> : !ready ? <div className="loading" role="status"><span className="spinner"/>Abrindo seu espaço local…</div> : !local.loaded ? <Empty title="Não foi possível abrir seus dados" action={<Button  onClick={() => void local.reload()}>Tentar novamente</Button>}><p>O arquivo original foi preservado. Confira a mensagem acima.</p></Empty> : route.page === 'explorar' ? <Explore renderActions={renderActions} onAddTrack={() => setTrackEditor('new')} params={route.params} catalog={catalog} workspace={local.workspace} query={query} filters={filters} setFilters={(f, options) => go('/explorar', filtersToParams(f, route.params), options)} search={search}/> : route.page === 'artista' ? <ArtistPage params={route.params} exploreUrl={exploreUrl} key={route.id} catalog={catalog} id={route.id}/> : route.page === 'album' ? <AlbumPage key={route.id} catalog={catalog} id={route.id} params={route.params} exploreUrl={exploreUrl}/> : route.page === 'musica' ? <Song catalogActions={song ? renderActions(song) : undefined} onEditTrack={setTrackEditor} exploreUrl={exploreUrl} key={route.id} catalog={catalog} workspace={local.workspace} id={route.id} params={route.params} commit={local.commit} notify={notify} drafts={drafts[route.id] ?? []} onDrafts={f => setDrafts(previous => ({...previous, [route.id]: f}))}/> : projectPage ? <Projects key={route.page + route.id} catalog={catalog} workspace={local.workspace} id={route.page === 'projeto' ? route.id : ''} commit={local.commit} notify={notify}/> : <Empty title="Página não encontrada" action={<ButtonLink  href="#/explorar">Voltar a Explorar</ButtonLink>}/>}
    </main>
    <footer className="app-footer"><div className="footer-top"><div className="footer-brand"><SurfaceLink className="brand" href="#/explorar"><img src="/marca.svg" alt=""/>scratches</SurfaceLink><p>Pesquisa para suas linhas de scratch.</p></div><nav aria-label="Informações">{Object.keys(footerContent).map(label => <TextAction size="xs" key={label} onClick={() => setFooter(label)}>{label}</TextAction>)}</nav></div><hr className="footer-divider"/><div className="footer-bottom"><small>© 2026 Scratches</small><div className="footer-updates"><Updates saving={local.saving} hasDrafts={!!trackEditor || Object.values(drafts).some(items => items.length > 0)}/></div></div></footer>
    <BackToTop/>
    {trackEditor && catalog && <TrackEditor workspace={local.workspace} existing={trackEditor === 'new' ? undefined : trackEditor} catalog={catalog} commit={local.commit} onClose={() => setTrackEditor(undefined)} onSaved={track => {setTrackEditor(undefined); go('/musica/' + encodeURIComponent(track.id)); notify(trackEditor === 'new' ? 'Música adicionada ao seu catálogo.' : 'Metadados salvos.');}}/>}
    {deletingTrack && baseCatalog && <DeleteTrackDialog track={deletingTrack} baseCatalog={baseCatalog} commit={local.commit} notify={notify} onClose={() => setDeletingTrack(undefined)} onDeleted={() => {setDeletingTrack(undefined); if (route.page === 'musica' && route.id === deletingTrack.id) go('/explorar');}}/>}
    {space && <LocalSpace workspace={local.workspace} commit={local.commit} onClose={() => setSpace(false)} notify={notify}/>}
    {footer === 'Enviar feedback' && <FeedbackDialog draft={feedbackDraft} onChange={setFeedbackDraft} onClose={() => setFooter('')} onSent={() => {setFooter(''); setFeedbackDraft(emptyFeedbackDraft()); notify('Feedback enviado. Obrigado por ajudar a melhorar o Scratches.');}}/>}
    {footer && footer !== 'Enviar feedback' && <Dialog title={footerContent[footer].title} onClose={() => setFooter('')}><p className="info-body">{footerContent[footer].body}</p></Dialog>}
    {toast && <Toast key={toast.id} toast={toast} onClose={closeToast} notify={notify}/>}
  </div>;
}
