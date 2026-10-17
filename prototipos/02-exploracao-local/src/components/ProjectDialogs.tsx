import {Button, TextAction} from './Controls.tsx';
import {useEffect, useRef, useState} from 'react';
import {assessFragmentSelection, normalize, saveFragments} from '../domain/model.ts';
import type {Fragment, Project, Workspace} from '../domain/model.ts';
import {go} from '../routing.ts';
import {Dialog, Icon} from './UI.tsx';
export type Commit = (change: (state: Workspace) => Workspace) => Promise<Workspace>;
export function SaveDialog({fragments, workspace, commit, onClose, onSaved}: {fragments: Fragment[]; workspace: Workspace; commit: Commit; onClose: () => void; onSaved: (message: string) => void}) {
  const [query, setQuery] = useState(''); const [creating, setCreating] = useState(false);
  const [name, setName] = useState(''); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const searchInput = useRef<HTMLInputElement>(null); const running = useRef(false);
  useEffect(() => {searchInput.current?.focus();}, []);
  const projects = workspace.projects.filter(project => normalize(project.name).includes(normalize(query))).toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  async function save(projectId: string, newName?: string) {
    if (running.current || !fragments.length || (newName !== undefined && !newName.trim())) return;
    running.current = true; setPending(true); setError(''); let saved: Project | undefined; let added = 0; let duplicates = 0;
    try {await commit(w => {const result = saveFragments(w, projectId, fragments, newName);
      if (!result.added) throw new Error('Este projeto já contém todos os trechos selecionados. Escolha outro projeto ou crie um novo.');
      saved = result.project; added = result.added; duplicates = result.duplicates; return result.workspace;});
      onSaved(`${added} ${added === 1 ? 'trecho salvo' : 'trechos salvos'} em ${saved!.name}.${duplicates ? ` ${duplicates} já ${duplicates === 1 ? 'estava salvo' : 'estavam salvos'}.` : ''}`);
    } catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.');} finally {running.current = false; setPending(false);}
  }
  return <Dialog title="Adicionar a projeto" onClose={onClose} closeDisabled={pending} className="save-project-dialog"><p className="muted">{fragments.length} {fragments.length === 1 ? 'trecho selecionado' : 'trechos selecionados'}. Escolha um projeto para salvar.</p>
    {workspace.projects.length > 0 && <label className="form-field">Buscar projeto<input ref={searchInput} type="search" value={query} disabled={pending} onChange={event => setQuery(event.target.value)} placeholder="Nome do projeto"/></label>}
    <div className="project-picker-list" aria-label="Projetos disponíveis">{projects.length ? projects.map(project => {
      const {additions, duplicates} = assessFragmentSelection(project, fragments);
      const alreadySaved = additions.length === 0;
      return <Button key={project.id} className="project-picker-option" disabled={pending || alreadySaved || !fragments.length}
        aria-label={alreadySaved ? `${project.name}: todos os trechos já salvos` : `Salvar ${additions.length} ${additions.length === 1 ? 'novo trecho' : 'novos trechos'} em ${project.name}`}
        onClick={() => void save(project.id)}><Icon name="folder"/><span><strong>{project.name}</strong><small>{project.fragments.length} {project.fragments.length === 1 ? 'trecho no projeto' : 'trechos no projeto'}{duplicates > 0 && !alreadySaved ? ` · ${duplicates} já ${duplicates === 1 ? 'salvo' : 'salvos'}` : ''}</small></span>
        {alreadySaved ? <span className="project-picker-status"><Icon name="check" size={16}/>Já salvo</span> : <span className="project-picker-status">{additions.length} {additions.length === 1 ? 'novo' : 'novos'}<Icon name="arrow" size={16}/></span>}
      </Button>;
    }) : <p className="project-picker-empty">{workspace.projects.length ? 'Nenhum projeto encontrado. Você pode criar um novo abaixo.' : 'Você ainda não tem projetos. Crie o primeiro para guardar esta seleção.'}</p>}</div>
    <div className="project-picker-create">{creating ? <form onSubmit={event => {event.preventDefault(); void save('', name);}}>
      <label className="form-field">Nome do novo projeto<input autoFocus maxLength={100} disabled={pending} value={name} onChange={event => setName(event.target.value)} placeholder="Como você quer chamar esta linha?"/></label>
      <div className="project-create-actions"><TextAction disabled={pending} onClick={() => setCreating(false)}>Cancelar criação</TextAction><Button variant="primary" type="submit" disabled={pending || !name.trim() || !fragments.length}>{pending ? 'Salvando…' : 'Criar e salvar'}</Button></div>
    </form> : <Button className="wide" disabled={pending} onClick={() => {setName(query); setCreating(true);}}><Icon name="plus"/>Novo projeto</Button>}</div>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="dialog-actions"><Button onClick={onClose} disabled={pending}>Cancelar</Button></div>
  </Dialog>;
}
export function ProjectNameDialog({project, commit, onClose, notify}: {project?: Project; commit: Commit; onClose: () => void; notify: (message: string) => void}) {
  const [name, setName] = useState(project?.name ?? ''); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  return <Dialog title={project ? 'Renomear projeto' : 'Novo projeto'} onClose={onClose}><form onSubmit={e => {e.preventDefault(); if (pending || !name.trim()) return; setPending(true); const id = project?.id ?? crypto.randomUUID(); void commit(w => {const now = new Date().toISOString(); return {...w, projects: project ? w.projects.map(p => p.id === id ? {...p, name: name.trim(), updatedAt: now} : p) : [...w.projects, {id, name: name.trim(), createdAt: now, updatedAt: now, fragments: []}]};}).then(() => {notify(project ? 'Projeto renomeado.' : 'Projeto criado.'); onClose(); if (!project) go('/projeto/' + id);}).catch(e => setError(e.message)).finally(() => setPending(false));}}><label className="form-field">Nome do projeto<input autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Nome da sua linha"/></label>{error && <p className="error-text" role="alert">{error}</p>}<div className="dialog-actions"><Button type="button"  onClick={onClose} disabled={pending}>Cancelar</Button><Button variant="primary" type="submit"  disabled={pending || !name.trim()}>{pending ? 'Salvando…' : project ? 'Salvar nome' : 'Criar projeto'}</Button></div></form></Dialog>;
}
