import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {providerArtwork} from './artwork-source.mjs';

// Only provider artwork; this endpoint must never become an arbitrary URL proxy.
export {providerArtwork} from './artwork-source.mjs';
const maxBytes = 1024 * 1024;
function imageType(bytes) {
  if (bytes.length < 12 || bytes.length > maxBytes) return null;
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') return 'image/webp';
  return null;
}
export class ArtworkCache {
  constructor(root, {fetchImpl = fetch, cooldown = 30000} = {}) {
    this.folder = path.join(root, '.scratches', 'artwork');
    this.fetch = fetchImpl; this.cooldown = cooldown;
    this.pending = new Map(); this.failures = new Map();
  }
  async get(source) {
    if (!providerArtwork(source)) return null;
    const key = createHash('sha256').update(source).digest('hex');
    const file = path.join(this.folder, key);
    try {
      const stat = await fs.stat(file);
      if (stat.size <= maxBytes) {
        const bytes = await fs.readFile(file), type = imageType(bytes);
        if (type) return {bytes, type};
      }
    } catch (error) {if (error.code !== 'ENOENT') throw error;}
    // Distributed artwork is immutable and survives without network access.
    try {
      const bundled=path.resolve(this.folder,'../../lib/seed/artwork',key);
      const stat=await fs.stat(bundled);
      if(stat.size<=maxBytes){const bytes=await fs.readFile(bundled),type=imageType(bytes);if(type)return {bytes,type};}
    } catch(error) {if(error.code!=='ENOENT')throw error;}
    if (this.pending.has(key)) return this.pending.get(key);
    if ((this.failures.get(key) ?? 0) > Date.now() || this.pending.size >= 4) return null;
    const job = this.download(source, file).then(result => {
      if (!result) {
        if (this.failures.size >= 2048) this.failures.delete(this.failures.keys().next().value);
        this.failures.set(key, Date.now() + this.cooldown);
      } else this.failures.delete(key);
      return result;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, job);
    return job;
  }
  async download(source, file) {
    try {
      const response = await this.fetch(source, {redirect: 'error', signal: AbortSignal.timeout(8000)});
      if (!response.ok || !/^image\/(?:jpeg|png|webp)(?:;|$)/i.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length')) > maxBytes) {await response.body?.cancel(); return null;}
      const chunks = []; let size = 0;
      const reader = response.body?.getReader(); if (!reader) return null;
      try {
        while (true) {
          const {done, value} = await reader.read(); if (done) break;
          size += value.length; if (size > maxBytes) return null;
          chunks.push(value);
        }
      } finally {await reader.cancel().catch(() => {});}
      const bytes = Buffer.concat(chunks), type = imageType(bytes);
      if (!type) return null;
      await fs.mkdir(this.folder, {recursive: true});
      const temporary = file + '.' + randomUUID() + '.tmp';
      try {await fs.writeFile(temporary, bytes); await fs.rename(temporary, file);}
      finally {await fs.rm(temporary, {force:true}).catch(() => {});}
      return {bytes, type};
    } catch {return null;}
  }
}
export function artworkApi(cache) {
  return async (req, res, next) => {
    if (req.url?.split('?')[0] !== '/api/artwork') return next();
    const send = status => {res.writeHead(status, {'Cache-Control':'no-store'}); res.end();};
    const host = req.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') || req.headers['sec-fetch-site'] === 'cross-site' || req.headers.origin && req.headers.origin !== 'http://' + host) return send(403);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(405);
    try {
      const source = new URL(req.url, 'http://' + host).searchParams.get('source');
      if (!providerArtwork(source)) return send(400);
      const result = await cache.get(source);
      if (!result) return send(503);
      res.writeHead(200, {'Content-Type':result.type, 'Content-Length':result.bytes.length, 'Cache-Control':'public, max-age=31536000, immutable', 'X-Content-Type-Options':'nosniff'});
      res.end(req.method === 'HEAD' ? undefined : result.bytes);
    } catch {send(503);}
  };
}
