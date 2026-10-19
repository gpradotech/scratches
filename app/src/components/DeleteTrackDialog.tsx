import {useState} from 'react';
import type {Catalog, Track} from '../domain/model.ts';
import {deleteGeneralTrack} from '../domain/library.ts';
import {Button} from './Controls.tsx';
import {Dialog} from './UI.tsx';
import type {Commit} from './ProjectDialogs.tsx';
import type {Notify} from './Toast.tsx';

export function DeleteTrackDialog({track, baseCatalog, commit, notify, onClose, onDeleted}: {
  track: Track; baseCatalog: Catalog; commit: Commit; notify: Notify; onClose: () => void; onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function remove() {
    if (busy) return;
    setBusy(true); setError('');
    let removed = track;
    try {
      await commit(current => {
        removed = current.tracks?.[track.id] ?? track;
        return deleteGeneralTrack(current, baseCatalog, track.id);
      });
      onDeleted();
      notify('Música excluída do catálogo.', {label: 'Desfazer', run: async () => {
        await commit(current => {
          if (current.tracks?.[removed.id]) throw new Error('Esta música já foi adicionada novamente. Seus dados atuais foram preservados.');
          return {...current, tracks: {...current.tracks, [removed.id]: removed}};
        });
        return 'Música restaurada.';
      }});
    } catch (error) {setError(error instanceof Error ? error.message : 'Não foi possível excluir.');}
    finally {setBusy(false);}
  }
  return <Dialog title="Excluir música do catálogo?" onClose={onClose} closeDisabled={busy}>
    <p>“{track.title}” será excluída do catálogo. Seus trechos em projetos e letras serão preservados.</p>
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className="dialog-actions"><Button disabled={busy} onClick={onClose}>Cancelar</Button><Button variant="danger" disabled={busy} onClick={() => void remove()}>{busy ? 'Excluindo…' : 'Excluir música'}</Button></div>
  </Dialog>;
}
