import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

export async function instanceInfo(root, mode) {
  const realRoot = await fs.realpath(root);
  const identity = process.platform === 'win32' ? realRoot.toLowerCase() : realRoot;
  const pkg = JSON.parse(await fs.readFile(path.join(realRoot, 'package.json'), 'utf8'));
  return {app: 'scratches', installationId: createHash('sha256').update(identity).digest('hex'), version: pkg.version, mode};
}

export function instanceApi(info) {
  return (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/instance') return next();
    const host = req.headers.host || '', origin = req.headers.origin;
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const allowed = local && /^(127\.0\.0\.1|localhost):\d+$/.test(host) && (!origin || origin === 'http://' + host) && req.headers['sec-fetch-site'] !== 'cross-site';
    res.writeHead(!allowed ? 403 : req.method !== 'GET' ? 405 : 200, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
    res.end(JSON.stringify(!allowed ? {error: 'Acesso permitido apenas pelo aplicativo local.'} : req.method !== 'GET' ? {error: 'Método não disponível.'} : info));
  };
}
