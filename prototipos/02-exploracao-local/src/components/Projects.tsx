import {ProjectTrackCard} from './ProjectTrackCard.tsx';
import {Button, ButtonLink, IconButton, SegmentedControl, SurfaceLink, TextLink} from './Controls.tsx';
import {useState} from 'react';
import type {Catalog, Fragment, Project, Workspace} from '../domain/model.ts';
import {fragmentLines} from '../domain/model.ts';
import {deleteFromProject, rememberDeleteConfirmation, skipDeleteConfirmation} from '../domain/projectDeletion.ts';
import type {Deletion, DeletionTarget} from '../domain/projectDeletion.ts';
import {go, trackUrl} from '../routing.ts';
import {Cover, Empty, Icon} from './UI.tsx';
import {DeleteDialog} from './DeleteDialog.tsx';
import type {Notify} from './Toast.tsx';
import {ProjectNameDialog} from './ProjectDialogs.tsx';
import type {Commit} from './ProjectDialogs.tsx';
const collectionLabel = (p: Project) => {const count = new Set(p.fragments.map(f => f.trackId)).size; return count + (count === 1 ? " música" : " músicas") + " · " + p.fragments.length + (p.fragments.length === 1 ? " trecho" : " trechos");};
export function Projects({catalog, workspace, id, commit, notify}: {catalog: Catalog; workspace: Workspace; id: string; commit: Commit; notify: Notify}) {
  const [view, setView] = useState('songs'); const [naming, setNaming] = useState(false); const [rename, setRename] = useState<Project>(); const [deleting, setDeleting] = useState<DeletionTarget>(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const project = workspace.projects.find(p => p.id === id);
  async function remove(target: DeletionTarget, skipNext = false) {
    setBusy(true); setError('');
    let deletion: Deletion | undefined;
    try {
      await commit(current => {deletion = deleteFromProject(current, target); return deletion.workspace;});
      if (skipNext) {try {rememberDeleteConfirmation(window.localStorage, target.kind);} catch {/* Storage access can be blocked. */}}
      setDeleting(undefined);
      if (target.kind === 'project' && id === target.projectId) go('/projetos');
      const restore = deletion!.restore;
      notify(target.kind === 'project' ? 'Projeto excluído.' : 'Trecho removido do projeto.', {label: 'Desfazer', run: async () => {
        await commit(restore);
        return target.kind === 'project' ? 'Projeto restaurado.' : 'Trecho restaurado no projeto.';
      }});
    } finally {setBusy(false);}
  }
  function requestDelete(target: DeletionTarget) {
    if (busy) return;
    let skip = false;
    try {skip = skipDeleteConfirmation(window.localStorage, target.kind);} catch {/* Ask when storage is unavailable. */}
    if (skip) void remove(target).catch(e => setError((e as Error).message));
    else setDeleting(target);
  }
  function excerpt(f: Fragment, p: Project, number: number) {const track = catalog.tracks.find(t => t.id === f.trackId); const current = workspace.lyrics[f.trackId]; const sameRevision = current?.revision === f.lyricRevision;
    return <article className="saved-excerpt" key={f.id}><div className="excerpt-heading"><div className="excerpt-info"><strong>Trecho {number}</strong><span className="excerpt-reference"><small>· linhas {fragmentLines(f, current).startLine}–{fragmentLines(f, current).endLine}</small>{track && <TextLink size="sm" className="text-button" href={trackUrl(f.trackId) + `?inicio=${f.start}&fim=${f.end}&rev=${encodeURIComponent(f.lyricRevision)}`}>{sameRevision ? 'Ver na letra' : 'Abrir música'} <Icon name="arrow" size={16}/></TextLink>}</span></div><IconButton variant="danger" disabled={busy} aria-label={'Remover trecho ' + number + ' do projeto'} onClick={() => requestDelete({kind: 'fragment', projectId: p.id, fragmentId: f.id})}><Icon name="trash" size={17}/></IconButton></div><blockquote>{f.text}</blockquote>{!sameRevision && <p className="caption">Cópia do trecho preservada. {current ? 'A letra atual é de outra versão.' : 'A letra original não está no acervo local.'}</p>}</article>;
  }
  return <>{id ? project ? <>
    <div className="breadcrumb"><TextLink href="#/projetos">Projetos</TextLink><span>/</span>{project.name}</div>
    <div className="project-heading"><div className="project-title-block"><div className="project-title-row">
      <h1>{project.name}</h1><IconButton variant="plain" aria-label="Renomear projeto" title="Renomear projeto" onClick={() => setRename(project)}><Icon name="pencil" size={18}/></IconButton>
    </div><p className="muted">{collectionLabel(project)}</p></div></div>
    <div className="project-view-toolbar"><SegmentedControl label="Visualização do projeto" value={view} onChange={setView} options={[{value: 'songs', label: 'Por música'}, {value: 'fragments', label: 'Por trechos'}]}/></div>
    {!project.fragments.length ? <Empty title="Uma linha começa pelo primeiro trecho" action={<ButtonLink variant="primary" href="#/explorar">Explorar músicas <Icon name="arrow"/></ButtonLink>}><p>Este projeto está pronto para receber os trechos que você encontrar.</p></Empty> : view === 'songs' ? <div className="project-songs">
      {[...new Set(project.fragments.map(fragment => fragment.trackId))].map(trackId => {
        const track = catalog.tracks.find(item => item.id === trackId);
        const fragments = project.fragments.filter(fragment => fragment.trackId === trackId);
        return <ProjectTrackCard key={trackId} track={track} trackId={trackId} count={fragments.length}>
          {fragments.map(fragment => excerpt(fragment, project, project.fragments.indexOf(fragment) + 1))}
        </ProjectTrackCard>;
      })}
    </div> : <div className="project-passages">
      {project.fragments.map((fragment, index) => <ProjectTrackCard key={fragment.id} track={catalog.tracks.find(track => track.id === fragment.trackId)} trackId={fragment.trackId}>
        {excerpt(fragment, project, index + 1)}
      </ProjectTrackCard>)}
    </div>}
  </> : <Empty title="Projeto não encontrado" action={<ButtonLink href="#/projetos">Ver meus projetos</ButtonLink>}/> : <>
    <div className="project-heading"><div><h1>Projetos</h1><p className="muted">Suas músicas e trechos, organizados para continuar de onde parou.</p></div><Button variant="primary" onClick={() => setNaming(true)}><Icon name="plus"/>Novo projeto</Button></div>
    {!workspace.projects.length ? <Empty title="Seu primeiro projeto começa aqui" action={<Button variant="primary" onClick={() => setNaming(true)}><Icon name="plus"/>Criar projeto</Button>}><p>Organize trechos de diferentes músicas e reúna referências para suas linhas de scratch.</p></Empty> : <div className="project-list">{workspace.projects.toSorted((a,b) => b.updatedAt.localeCompare(a.updatedAt)).map(p => {const covers = [...new Set(p.fragments.map(f => f.trackId))].map(id => catalog.tracks.find(t => t.id === id)).filter(t => !!t).slice(0, 4); return <article className="project-list-item" key={p.id}><SurfaceLink className="project-mosaic" href={'#/projeto/' + p.id} tabIndex={-1} aria-hidden="true">{covers.length ? covers.map(t => <Cover key={t.id} track={t}/>) : <Icon name="folder" size={30}/>}</SurfaceLink><SurfaceLink className="project-list-name" href={'#/projeto/' + p.id}><strong>{p.name}</strong><span className="muted">{collectionLabel(p)}</span><small>Atualizado em {new Date(p.updatedAt).toLocaleDateString('pt-BR')}</small></SurfaceLink><ButtonLink href={'#/projeto/' + p.id}>Abrir projeto <Icon name="arrow" size={17}/></ButtonLink><IconButton variant="danger" aria-label={'Excluir projeto ' + p.name} disabled={busy} onClick={() => requestDelete({kind: 'project', projectId: p.id})}><Icon name="trash" size={18}/></IconButton></article>;})}</div>}
  </>}{error && <p className="error-text" role="alert">{error}</p>}
  {(naming || rename) && <ProjectNameDialog project={rename} commit={commit} onClose={() => {setNaming(false); setRename(undefined);}} notify={notify}/>}
  {deleting && <DeleteDialog kind={deleting.kind} projectName={workspace.projects.find(p => p.id === deleting.projectId)?.name ?? ''} onClose={() => setDeleting(undefined)} onConfirm={skipNext => remove(deleting, skipNext)}/>}
  </>;
}
