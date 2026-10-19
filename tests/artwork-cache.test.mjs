import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {ArtworkCache, artworkApi, providerArtwork} from '../lib/artwork-cache.mjs';
import {artworkSources} from '../lib/artwork-source.mjs';

const source = 'https://cdn-images.dzcdn.net/images/cover/4188d007f37da7866cea9a1526adc2ee/500x500-000000-80-0-0.jpg';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const response = () => new Response(png, {headers:{'Content-Type':'image/png'}});
test('recuperação inclui músicas locais armazenadas por ID e remove URLs repetidas', () => {
  const other = source.replace('/cover/', '/artist/');
  assert.deepEqual(artworkSources({tracks:[{cover:source}],artists:[]}, {tracks:{a:{cover:source},b:{cover:other},c:{cover:'data:image/png;base64,AA=='}}}),[source,other]);
});
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scratches-artwork-'));
  t.after(async () => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + 'scratches-artwork-'));
    await fs.rm(root, {recursive:true, force:true});
  });
  return root;
}

test('cache une consultas simultâneas e conserva imagem após reiniciar sem acesso ao provedor', async t => {
  const root = await temporary(t); let calls = 0;
  const cache = new ArtworkCache(root, {fetchImpl:async () => {calls++; return response();}});
  const [a, b] = await Promise.all([cache.get(source), cache.get(source)]);
  assert.equal(calls, 1); assert.deepEqual(a.bytes, png); assert.deepEqual(b.bytes, png);
  const offline = new ArtworkCache(root, {fetchImpl:async () => {throw Error('Sem rede');}});
  assert.deepEqual((await offline.get(source)).bytes, png);
  assert.equal((await offline.get(source)).type, 'image/png');
  assert.equal((await fs.readdir(path.join(root, '.scratches/artwork'))).length, 1);
});
test('imagem distribuída funciona sem rede e sem cache privado anterior',async t=>{
  const root=await temporary(t);const {createHash}=await import('node:crypto');
  const folder=path.join(root,'lib/seed/artwork');await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(folder,createHash('sha256').update(source).digest('hex')),png);
  const cache=new ArtworkCache(root,{fetchImpl:async()=>{throw Error('Não deveria consultar a rede');}});
  assert.deepEqual((await cache.get(source)).bytes,png);
});

test('recusa SSRF, redirecionamentos, HTML e arquivos grandes sem guardar uma falha permanente', async t => {
  const root = await temporary(t); let calls = 0;
  const cache = new ArtworkCache(root, {cooldown:0, fetchImpl:async (_url, options) => {
    assert.equal(options.redirect, 'error'); calls++;
    return calls === 1 ? new Response('<script>alert(1)</script>', {headers:{'Content-Type':'image/jpeg'}})
      : calls === 2 ? new Response(png, {headers:{'Content-Type':'image/png','Content-Length':'2000000'}})
      : calls === 3 ? new Response(new Uint8Array(1048577), {headers:{'Content-Type':'image/png'}})
      : response();
  }});
  for (const bad of ['http://127.0.0.1/secret', source.replace('dzcdn.net','dzcdn.net.evil.test'), source + '?redirect=http://localhost', source.replace('https://','https://user:pass@'), source.replace('/cover/','/../../')]) {
    assert.equal(providerArtwork(bad), false); assert.equal(await cache.get(bad), null);
  }
  assert.equal(calls, 0);
  assert.equal(await cache.get(source), null);
  assert.equal(await cache.get(source), null);
  assert.equal(await cache.get(source), null);
  assert.deepEqual((await cache.get(source)).bytes, png);
});

test('503 tem nova tentativa posterior; endpoint aceita só acesso local e serve bytes corretos', async t => {
  const root = await temporary(t); let calls = 0;
  const api = artworkApi(new ArtworkCache(root, {cooldown:0, fetchImpl:async () => ++calls === 1 ? new Response(null,{status:403}) : response()}));
  const server = http.createServer((req,res) => void api(req,res,() => {res.writeHead(404);res.end();}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  const base = 'http://127.0.0.1:' + server.address().port;
  const address = base + '/api/artwork?source=' + encodeURIComponent(source);
  assert.equal((await fetch(address, {headers:{Origin:'https://evil.test'}})).status, 403);
  assert.equal((await fetch(address, {headers:{'Sec-Fetch-Site':'cross-site'}})).status, 403);
  assert.equal((await fetch(address, {method:'POST'})).status, 405);
  assert.equal((await fetch(base + '/api/artwork?source=http://localhost')).status, 400);
  assert.equal(calls, 0);
  const failure = await fetch(address); assert.equal(failure.status, 503); assert.equal(failure.headers.get('Cache-Control'), 'no-store');
  const success = await fetch(address); assert.equal(success.status, 200); assert.equal(success.headers.get('Content-Type'),'image/png');
  assert.deepEqual(Buffer.from(await success.arrayBuffer()), png);
  assert.equal((await fetch(address, {method:'HEAD'})).status, 200); assert.equal(calls, 2);
});
