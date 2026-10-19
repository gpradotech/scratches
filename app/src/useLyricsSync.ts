import {useEffect, useState} from 'react';
interface LyricsStatus {running: boolean; total: number; processed: number; indexed: number; existing: number; missing: number; instrumental: number; errors: number; error?: string; retrying?: boolean; retryProcessed?: number; retryTotal?: number}
export function useLyricsSync(trackCount: number, refresh: () => Promise<void>) {
  const [status, setStatus] = useState<LyricsStatus>();
  useEffect(() => {
    if (!trackCount) return;
    let active = true, timer: ReturnType<typeof setTimeout> | undefined, previous = -1;
    const controller = new AbortController();
    async function poll(start = false) {
      try {
        const response = await fetch('/api/lyrics/sync', {method: start ? 'POST' : 'GET', signal: controller.signal});
        if (!response.ok) throw new Error('Não foi possível consultar as letras agora.');
        const state = await response.json() as LyricsStatus;
        if (!active) return;
        setStatus(state);
        if (state.indexed !== previous) {previous = state.indexed; await refresh();}
        if (state.running || !state.error && state.total !== trackCount) timer = setTimeout(() => void poll(!state.running), 2500);
        else await refresh();
      } catch {if (active) setStatus({running:false,total:trackCount,processed:0,indexed:0,existing:0,missing:0,instrumental:0,errors:1,error:'A busca automática de letras está indisponível. Reabra a aplicação para tentar novamente.'});}
    }
    void poll(true);
    return () => {active = false; controller.abort(); clearTimeout(timer);};
  }, [trackCount, refresh]);
  return status;
}
