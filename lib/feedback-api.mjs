import {feedbackEndpoint} from './feedback-config.mjs';
import {feedbackResponse, readFeedback} from './feedback.mjs';

export function feedbackApi({endpoint = process.env.SCRATCHES_FEEDBACK_ENDPOINT || feedbackEndpoint, request = fetch} = {}) {
  let target;
  try {const url = new URL(endpoint); if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash) target = url.href;} catch {}
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/feedback') return next();
    const host = req.headers.host || '', origin = req.headers.origin;
    const send = (status, body) => feedbackResponse(res, status, body);
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || origin && origin !== 'http://' + host || req.headers['sec-fetch-site'] === 'cross-site') return send(403, {error: 'Abra o formulário pelo Scratches.'});
    if (req.method === 'GET') {
      if (!target) return send(200, {available: false});
      try {const response = await request(target, {redirect: 'error', signal: AbortSignal.timeout(8000)}); const data = await response.json(); return send(200, {available: response.ok && data.available === true});}
      catch {return send(200, {available: false});}
    }
    if (req.method !== 'POST') return send(405, {error: 'Método não disponível.'});
    if (req.headers['x-scratches-feedback'] !== '1' || !req.headers['content-type']?.startsWith('application/json')) return send(403, {error: 'Abra o formulário pelo Scratches.'});
    if (!target) return send(503, {error: 'O envio de feedback ainda não está disponível. Sua mensagem não foi enviada.'});
    let payload; try {payload = await readFeedback(req);} catch (error) {return send(400, {error: error.message});}
    try {
      const response = await request(target, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(15000)});
      const data = await response.json();
      if (!response.ok || data.accepted !== true) return send(response.status === 429 ? 429 : 502, {error: response.status === 429 ? 'Aguarde alguns minutos antes de tentar novamente.' : 'Não foi possível enviar agora. Sua mensagem foi mantida para tentar novamente.'});
      return send(202, {accepted: true});
    } catch {return send(502, {error: 'Não foi possível enviar agora. Sua mensagem foi mantida para tentar novamente.'});}
  };
}
