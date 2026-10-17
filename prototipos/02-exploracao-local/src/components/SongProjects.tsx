import type {Lyric, Workspace} from '../domain/model.ts';
import {fragmentLines} from '../domain/model.ts';
import {CountBadge, TextLink} from './Controls.tsx';
import {Icon} from './UI.tsx';

export function SongProjects({workspace, trackId, lyric}: {workspace: Workspace; trackId: string; lyric?: Lyric}) {
  const projects = workspace.projects.filter(project => project.fragments.some(fragment => fragment.trackId === trackId))
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <section className="song-projects" aria-labelledby="song-projects-heading">
    <h2 id="song-projects-heading">Trechos em projetos</h2>
    {projects.length ? <><p className="caption">Os trechos salvos nesta versão da letra aparecem destacados.</p>
      <ul className="song-projects-list">{projects.map(project => {
        const fragments = project.fragments.filter(fragment => fragment.trackId === trackId);
        const references = [...new Set(fragments.map(fragment => fragmentLines(fragment, lyric))
          .toSorted((a, b) => a.startLine - b.startLine || a.endLine - b.endLine)
          .map(({startLine, endLine}) => startLine === endLine ? String(startLine) : `${startLine}–${endLine}`))];
        const oldVersion = fragments.some(fragment => fragment.lyricRevision !== lyric?.revision);
        return <li key={project.id}><div className="song-project-link"><TextLink href={'#/projeto/' + encodeURIComponent(project.id)}><Icon name="folder" size={17}/>{project.name}<Icon name="arrow" size={16}/></TextLink>
          <CountBadge>{fragments.length} {fragments.length === 1 ? 'trecho' : 'trechos'}</CountBadge></div>
          <p className="caption">{references.length === 1 && !references[0].includes('–') ? 'Linha' : 'Linhas'} {references.join(', ')}{oldVersion && ' · Inclui trecho de outra versão da letra'}</p>
        </li>;
      })}</ul></> : <p className="caption">Nenhum projeto tem trechos desta música ainda.</p>}
  </section>;
}
