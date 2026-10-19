import type {Track} from '../domain/model.ts';
import {TextAction} from './Controls.tsx';
import {Icon} from './UI.tsx';

export function CatalogTrackActions({track, canDelete, disabled, onDelete}: {
  track: Track; canDelete: boolean; disabled: boolean;
  onDelete: (track: Track) => void;
}) {
  if (!canDelete) return null;
  return <div className="catalog-track-actions" role="group" aria-label={'Catálogo de ' + track.title}>
    {canDelete && <TextAction disabled={disabled} size="xs" onClick={() => onDelete(track)}><Icon name="trash" size={16}/>Excluir música</TextAction>}
  </div>;
}
