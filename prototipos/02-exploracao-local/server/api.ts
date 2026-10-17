import type {IncomingMessage, ServerResponse} from 'node:http';
import {Conflict, WorkspaceStore} from './store.ts';
export function workspaceApi(store: WorkspaceStore) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split('?')[0] !== '/api/workspace') {next(); return;}
    const host = req.headers.host ?? '';
    const origin = req.headers.origin;
    const remote = req.socket.remoteAddress;
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote ?? '') || (origin && origin !== 'http://' + host) || req.headers['sec-fetch-site'] === 'cross-site') {
      res.writeHead(403, {'Content-Type': 'application/json'}); res.end(JSON.stringify({error: 'Acesso permitido apenas pelo aplicativo local.'})); return;
    }
    const send = (status: number, body: unknown) => {res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); res.end(JSON.stringify(body));};
    try {
      if (req.method === 'GET') {send(200, await store.read()); return;}
      if (req.method !== 'PUT') {send(405, {error: 'Método não disponível.'}); return;}
      if (!req.headers['content-type']?.startsWith('application/json')) {send(415, {error: 'Envie um arquivo JSON.'}); return;}
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of req) {size += chunk.length; if (size > 8_000_000) {send(413, {error: 'O espaço de trabalho excede 8 MB.'}); return;} chunks.push(Buffer.from(chunk));}
      let body: unknown;
      try {body = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {send(400, {error: 'JSON inválido.'}); return;}
      send(200, await store.save(body));
    } catch (e) {send(e instanceof Conflict ? 409 : e instanceof SyntaxError ? 500 : 400, {error: e instanceof Error ? e.message : 'Não foi possível salvar o arquivo local.'});}
  };
}
