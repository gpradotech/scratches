import {useState} from 'react';
import type {DeleteKind} from '../domain/projectDeletion.ts';
import {Button} from './Controls.tsx';
import {Dialog} from './UI.tsx';

export function DeleteDialog({kind, projectName, onClose, onConfirm}: {
  kind: DeleteKind; projectName: string; onClose: () => void; onConfirm: (skipNext: boolean) => Promise<void>;
}) {
  const [skipNext, setSkipNext] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const isProject = kind === 'project';
  async function confirm() {
    if (busy) return;
    setBusy(true); setError('');
    try {await onConfirm(skipNext);} catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível excluir. Tente novamente.');}
    finally {setBusy(false);}
  }
  return <Dialog title={isProject ? 'Excluir projeto?' : 'Remover trecho do projeto?'} onClose={onClose} closeDisabled={busy}>
    <p>{isProject ? `“${projectName}” e os trechos guardados nele serão removidos deste espaço. As letras permanecem no acervo.`
      : `O trecho será removido de “${projectName}”. A letra da música permanece no acervo.`}</p>
    <label className="check-label delete-preference"><input type="checkbox" checked={skipNext} disabled={busy} onChange={event => setSkipNext(event.target.checked)}/>
      Não perguntar novamente ao {isProject ? 'excluir projetos' : 'remover trechos'}
    </label>
    {error && <p className="error-text" role="alert">{error}</p>}
    <div className="dialog-actions"><Button disabled={busy} onClick={onClose} autoFocus>Cancelar</Button>
      <Button variant="danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Removendo…' : isProject ? 'Excluir projeto' : 'Remover trecho'}</Button>
    </div>
  </Dialog>;
}
