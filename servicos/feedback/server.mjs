import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {feedbackKinds, feedbackResponse, readFeedback} from '../../lib/feedback.mjs';

// Hosted separately. These secrets must never be copied into the local application or release package.
export function feedbackReceiver({apiKey = process.env.RESEND_API_KEY, from = process.env.FEEDBACK_FROM, to = process.env.FEEDBACK_TO, request = fetch, now = Date.now} = {}) {
  const configured = !!(apiKey && from && to);
  const attempts = new Map();
  return async (req, res) => {
    const send = (status, body) => feedbackResponse(res, status, body);
    if (req.url?.split('?')[0] !== '/api/feedback') return send(404, {error: 'Página não encontrada.'});
    if (req.method === 'GET') return send(200, {available: configured});
    if (req.method !== 'POST') return send(405, {error: 'Método não disponível.'});
    if (!configured) return send(503, {error: 'O envio de feedback ainda não está disponível.'});
    if (!req.headers['content-type']?.startsWith('application/json')) return send(415, {error: 'Solicitação inválida.'});
    const timestamp = now();
    for (const [key, entry] of attempts) if (entry.until <= timestamp) attempts.delete(key);
    const client = req.socket.remoteAddress || 'unknown';
    const entry = attempts.get(client) || {count: 0, until: timestamp + 600000};
    if (entry.count >= 5 || attempts.size >= 10000 && !attempts.has(client)) return send(429, {error: 'Aguarde alguns minutos antes de tentar novamente.'});
    entry.count++; attempts.set(client, entry);
    let payload; try {payload = await readFeedback(req);} catch (error) {return send(400, {error: error.message});}
    try {
      const response = await request('https://api.resend.com/emails', {method: 'POST', headers: {Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json', 'Idempotency-Key': 'feedback/' + payload.id},
        body: JSON.stringify({from, to: [to], subject: '[Scratches] ' + feedbackKinds[payload.kind], text: payload.message, ...(payload.email ? {reply_to: payload.email} : {})}), redirect: 'error', signal: AbortSignal.timeout(10000)});
      const data = await response.json();
      if (!response.ok || typeof data.id !== 'string' || !data.id) return send(502, {error: 'Não foi possível enviar agora. Tente novamente.'});
      return send(202, {accepted: true});
    } catch {return send(502, {error: 'Não foi possível enviar agora. Tente novamente.'});}
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const server = http.createServer(feedbackReceiver());
  server.listen(port, '0.0.0.0', () => console.log('Receptor de feedback iniciado.'));
}
