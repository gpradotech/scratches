import {useCallback, useEffect, useRef, useState} from 'react';
import {emptyWorkspace, validateWorkspace} from './domain/model.ts';
import type {Workspace} from './domain/model.ts';
import {onlyNewImportedLyrics} from './domain/lyricRefresh.ts';
async function readResponse(response: Response): Promise<Workspace> {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Não foi possível acessar o espaço local.');
  validateWorkspace(value); return value;
}
export function useWorkspace() {
  const [workspace, setWorkspace] = useState(emptyWorkspace);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState('');
  const current = useRef(workspace);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true); setError('');
    try {const data = await readResponse(await fetch('/api/workspace', {cache: 'no-store'})); if (data.revision >= current.current.revision) {current.current = data; setWorkspace(data);} setLoaded(true);}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível abrir os dados locais.');}
    finally {if (!quiet) setLoading(false);}
  }, []);
  const refresh = useCallback(() => load(true), [load]);
  useEffect(() => {void load();}, [load]);
  const commit = useCallback((change: (state: Workspace) => Workspace) => {
    setPending(n => n + 1);
    const operation = queue.current.catch(() => {}).then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const before = current.current;
        const next = change(before); validateWorkspace(next);
        const response = await fetch('/api/workspace', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(next)});
        if (response.status === 409 && attempt < 2) {
          const latest = await readResponse(await fetch('/api/workspace', {cache:'no-store'}));
          if (onlyNewImportedLyrics(before, latest)) {current.current = latest; setWorkspace(latest); continue;}
        }
        const saved = await readResponse(response);
        if (saved.revision >= current.current.revision) {current.current = saved; setWorkspace(saved);} setError(''); return saved;
      }
      throw new Error('O espaço foi alterado durante a gravação. Tente novamente.');
    }).catch(e => {setError(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.'); throw e;}).finally(() => setPending(n => n - 1));
    queue.current = operation;
    return operation;
  }, []);
  return {workspace, loading, loaded, saving: pending > 0, error, commit, reload: load, refresh};
}
