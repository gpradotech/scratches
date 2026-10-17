import {useEffect, useRef, useState} from 'react';
import {IconButton, TextAction} from './Controls.tsx';
import {Icon} from './UI.tsx';

export interface ToastAction {label: string; run: () => Promise<string>}
export interface ToastMessage {id: string; message: string; action?: ToastAction}
export type Notify = (message: string, action?: ToastAction) => void;

export function Toast({toast, onClose, notify}: {toast: ToastMessage; onClose: () => void; notify: Notify}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  useEffect(() => {
    if (hovered || focused || busy || error) return;
    const timer = setTimeout(onClose, toast.action ? 15000 : 6500);
    return () => clearTimeout(timer);
  }, [toast, onClose, hovered, focused, busy, error]);
  async function act() {
    if (!toast.action || running.current) return;
    running.current = true; setBusy(true); setError('');
    try {notify(await toast.action.run());}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível desfazer. Tente novamente.');}
    finally {running.current = false; setBusy(false);}
  }
  return <div className="toast" role="status" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => {if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);}}>
    <Icon name="check"/><div className="toast-content"><span>{toast.message}</span>{error && <span className="error-text" role="alert">{error}</span>}</div>
    {toast.action && <TextAction className="toast-action" disabled={busy} onClick={() => void act()}>{busy ? 'Desfazendo…' : toast.action.label}</TextAction>}
    <IconButton disabled={busy} aria-label="Fechar mensagem" onClick={onClose}><Icon name="close" size={16}/></IconButton>
  </div>;
}
