import {Button, TextAction} from './Controls.tsx';
import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Dialog} from './UI.tsx';

interface UpdateState {
  enabled: boolean; currentVersion: string | null; available: {version: string; notes: string} | null;
  phase: string; progress: number; checking: boolean; checkError: string; error: string; hasRelease: boolean;
  checkedAt: number | null; dismissedVersion: string | null; busy: boolean; canInstall: boolean; installNotice: string;
}
const active = (phase: string) => ['downloading', 'waiting-work', 'restarting'].includes(phase);
export function Updates({saving, hasDrafts}: {saving: boolean; hasDrafts: boolean}) {
  const [state, setState] = useState<UpdateState>();
  const [open, setOpen] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [connection, setConnection] = useState('');
  const blocked = useRef({saving, hasDrafts}); blocked.current = {saving, hasDrafts};
  const shown = useRef(''); const installed = useRef(''); const target = useRef(sessionStorage.getItem('scratches-update-target') ?? '');
  const client = useRef(crypto.randomUUID()); const reloadStarted = useRef(false);
  const safe = () => !blocked.current.saving && !blocked.current.hasDrafts && !document.querySelector('dialog[open]:not(:has(.update-content))');
  async function request(action = '', body = {}): Promise<UpdateState> {
    const response = await fetch('/api/updates' + (action ? '/' + action : ''), action ? {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Scratches-Update': '1'}, body: JSON.stringify(body)} : {cache: 'no-store'});
    if (!response.ok) {const value = await response.json().catch(() => ({})); throw new Error(value.error || 'Não foi possível verificar atualizações. Tente novamente.');}
    return response.json();
  }
  useEffect(() => {
    let closed = false, working = false;
    async function refresh() {
      if (working || reloadStarted.current) return;
      working = true;
      try {
        const next = await request('heartbeat', {clientId: client.current, safe: safe()});
        if (closed) return;
        setConnection('');
        if (!installed.current) installed.current = next.currentVersion ?? '';
        if (next.phase === 'restarting') {target.current = next.available?.version ?? ''; sessionStorage.setItem('scratches-update-target', target.current);}
        if (next.currentVersion && next.currentVersion !== installed.current && next.phase !== 'restarting') {
          if (safe()) {reloadStarted.current = true; location.reload(); return;}
          setConnection('Uma nova versão foi instalada. Salve ou encerre a edição antes de recarregar esta página.');
        }
        if (target.current === next.currentVersion && next.phase !== 'restarting') {target.current = ''; sessionStorage.removeItem('scratches-update-target'); setOpen(true);}
        if (target.current && next.phase === 'restored') {target.current = ''; sessionStorage.removeItem('scratches-update-target'); setOpen(true);}
        if (next.available && !active(next.phase) && next.dismissedVersion !== next.available.version && shown.current !== next.available.version && safe()) {shown.current = next.available.version; setOpen(true);}
        setState(next);
      } catch {if (!closed) setConnection(target.current ? 'Instalando e reiniciando… Esta página será reconectada automaticamente.' : 'Não foi possível consultar atualizações. Você pode continuar usando o Scratches.');}
      finally {working = false;}
    }
    const leave = () => {void fetch('/api/updates/leave', {method: 'POST', keepalive: true, headers: {'Content-Type': 'application/json', 'X-Scratches-Update': '1'}, body: JSON.stringify({clientId: client.current})}).catch(() => {});};
    void refresh(); const timer = setInterval(() => void refresh(), 1000);
    window.addEventListener('pagehide', leave);
    return () => {closed = true; clearInterval(timer); window.removeEventListener('pagehide', leave); leave();};
  }, []);
  async function perform(action: string, body = {}) {
    if (pending) return;
    setPending(true); setError('');
    try {setState(await request(action, body));}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível concluir a atualização.');}
    finally {setPending(false);}
  }
  function later() {
    if (pending || state && active(state.phase)) return;
    if (state?.available) void perform('dismiss', {version: state.available.version});
    setOpen(false);
  }
  const updating = !!state && active(state.phase);
  const restarting = state?.phase === 'restarting';
  let message = state?.available ? `A versão ${state.available.version} está disponível. Seus projetos, letras e trechos serão preservados.` : state?.hasRelease ? 'Você está usando a versão mais recente disponível.' : 'Ainda não há uma versão publicada para atualização.';
  if (state?.checking || pending) message = 'Consultando atualizações…';
  if (state?.checkError) message = state.checkError;
  if (state?.phase === 'downloading') message = `Baixando e verificando a atualização… ${state.progress}%`;
  if (state?.phase === 'waiting-work') message = 'Atualização pronta. Salve os trechos pendentes e conclua ou feche as edições abertas em todas as janelas. A instalação começará quando esse trabalho terminar.';
  if (restarting) message = 'Instalando e reiniciando… Mantenha a aplicação aberta. Esta página será reconectada automaticamente.';
  if (state?.phase === 'updated') message = `Atualização concluída. Você está usando a versão ${state.currentVersion}.`;
  if (state?.error || error || connection) message = error || connection || state?.error || message;
  return <>
    <TextAction size="xs" className="update-check" onClick={() => {setOpen(true); void perform('check');}}>Versão {state?.currentVersion ?? '…'} · Verificar atualizações</TextAction>
    {state?.available && !updating && <Button className="update-available" onClick={() => setOpen(true)}>Versão {state.available.version} disponível</Button>}
    {state?.phase === 'waiting-work' && <div className="update-waiting" role="status"><span>Atualização pronta. Conclua suas edições para instalar.</span><TextAction disabled={pending} onClick={() => void perform('cancel')}>Cancelar atualização</TextAction></div>}
    {(open || updating && state?.phase !== 'waiting-work' && safe()) && createPortal(<Dialog title={updating ? 'Atualizando Scratches' : state?.available ? 'Nova versão disponível' : 'Atualizações'} onClose={later} closeDisabled={updating || pending}>
      <div className="update-content"><p className="muted">Versão instalada: {state?.currentVersion ?? 'Consultando…'}</p><p role="status" aria-live="polite">{message}</p>
        {state?.phase === 'downloading' && <progress className="update-progress" max={100} value={state.progress} aria-label="Download da atualização"/>}
        {state?.available?.notes && !updating && <div className="update-notes"><h3>O que mudou</h3><p>{state.available.notes}</p></div>}
        {state && !state.canInstall && <p className="caption">{state.installNotice}</p>}
        <div className="dialog-actions">
          {!updating && <><Button disabled={pending || state?.checking} onClick={() => void perform('check')}>Verificar novamente</Button><Button disabled={pending} onClick={later}>{state?.available ? 'Mais tarde' : 'Fechar'}</Button></>}
          {state?.available && !updating && <Button variant="primary" disabled={pending || !state.canInstall} onClick={() => {setOpen(false); void perform('install', {version: state.available!.version});}}>{state.busy ? 'Atualizar após salvar' : 'Atualizar e reiniciar'}</Button>}
          {updating && !restarting && <Button disabled={pending} onClick={() => void perform('cancel')}>Cancelar atualização</Button>}
        </div>
      </div>
    </Dialog>, document.body)}
  </>;
}
