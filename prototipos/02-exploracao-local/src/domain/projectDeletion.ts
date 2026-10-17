import type {Fragment, Workspace} from './model.ts';
import {fragmentKey} from './model.ts';

export type DeletionTarget = {kind: 'fragment'; projectId: string; fragmentId: string} | {kind: 'project'; projectId: string};
export interface Deletion {workspace: Workspace; restore: (current: Workspace) => Workspace}

// Keep nearby IDs as anchors: undo must not replace newer changes or reorder new items.
function reinsert<T extends {id: string}>(current: T[], original: T[], item: T): T[] {
  if (current.some(value => value.id === item.id)) return current;
  const position = original.findIndex(value => value.id === item.id);
  const next = original.slice(position + 1).find(value => current.some(other => other.id === value.id));
  const previous = original.slice(0, position).findLast(value => current.some(other => other.id === value.id));
  const index = next ? current.findIndex(value => value.id === next.id)
    : previous ? current.findIndex(value => value.id === previous.id) + 1 : Math.min(position, current.length);
  return [...current.slice(0, index), item, ...current.slice(index)];
}

export function deleteFromProject(workspace: Workspace, target: DeletionTarget): Deletion {
  const project = workspace.projects.find(item => item.id === target.projectId);
  if (!project) throw new Error('Este projeto não está mais disponível. Recarregue seus dados.');
  if (target.kind === 'project') {
    return {
      workspace: {...workspace, projects: workspace.projects.filter(item => item.id !== project.id)},
      restore: current => ({...current, projects: reinsert(current.projects, workspace.projects, project)}),
    };
  }
  const fragment = project.fragments.find(item => item.id === target.fragmentId);
  if (!fragment) throw new Error('Este trecho não está mais no projeto. Recarregue seus dados.');
  const updateProject = (current: Workspace, fragments: Fragment[]): Workspace => ({...current,
    projects: current.projects.map(item => item.id === project.id ? {...item, updatedAt: new Date().toISOString(), fragments} : item),
  });
  return {
    workspace: updateProject(workspace, project.fragments.filter(item => item.id !== fragment.id)),
    restore: current => {
      const latest = current.projects.find(item => item.id === project.id);
      if (!latest) throw new Error('Restaure o projeto antes de desfazer a remoção deste trecho.');
      // A user may already have saved the same selection again, with another ID.
      if (latest.fragments.some(item => item.id === fragment.id || fragmentKey(item) === fragmentKey(fragment))) return current;
      return updateProject(current, reinsert(latest.fragments, project.fragments, fragment));
    },
  };
}

export type DeleteKind = DeletionTarget['kind'];
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
const preferenceKey = (kind: DeleteKind) => `scratches:skip-delete-confirmation:${kind}`;
export function skipDeleteConfirmation(storage: PreferenceStorage, kind: DeleteKind): boolean {
  try {return storage.getItem(preferenceKey(kind)) === 'true';} catch {return false;}
}
export function rememberDeleteConfirmation(storage: PreferenceStorage, kind: DeleteKind): void {
  try {storage.setItem(preferenceKey(kind), 'true');} catch {/* Keep asking if storage is unavailable. */}
}
