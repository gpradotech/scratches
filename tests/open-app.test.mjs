import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {openApp, runningApp} from '../scripts/open-app.mjs';
import {instanceInfo} from '../lib/app-instance.mjs';
import {createApp} from '../scripts/serve.mjs';
import {fixture, cleanFixture} from './update-fixtures.mjs';

test('abrir novamente reutiliza somente a mesma instalação e mantém o espaço pessoal intacto', async () => {
  const root = await fixture(); let app;
  try {
    const before = await fs.readFile(path.join(root, 'dados/prototipo-02/workspace.json'));
    app = await createApp({root, port: 0, updateOptions: {autoCheck: false}});
    const opened = [], messages = [], port = new URL(app.url).port;
    assert.equal(await openApp(root, {env: {SCRATCHES_PORT: port}, open: async url => opened.push(url), log: text => messages.push(text)}), 0);
    assert.deepEqual(opened, [app.url]); assert.ok(messages.some(text => text.includes('já está aberto')));
    assert.deepEqual(await fs.readFile(path.join(root, 'dados/prototipo-02/workspace.json')), before);
    assert.equal((await fetch(app.url)).status, 200);
    const info = await (await fetch(app.url + '/api/instance')).json();
    assert.equal(info.installationId.length, 64); assert.equal(JSON.stringify(info).includes(root), false);
    assert.equal((await fetch(app.url + '/api/instance', {headers: {Origin: 'https://example.invalid'}})).status, 403);
  } finally {await app?.close(); await cleanFixture(root);}
});

test('outra instalação na mesma porta não é aberta, encerrada ou alterada', async () => {
  const root = await fixture(), other = await fixture(); let app;
  try {
    app = await createApp({root: other, port: 0, updateOptions: {autoCheck: false}});
    const messages = [], port = new URL(app.url).port;
    assert.equal(await openApp(root, {env: {SCRATCHES_PORT: port}, open: async () => assert.fail('não deve abrir outra instalação'), log: text => messages.push(text)}), 1);
    assert.ok(messages.some(text => text.includes('instância antiga')));
    assert.equal((await fetch(app.url)).status, 200);
  } finally {await app?.close(); await cleanFixture(root); await cleanFixture(other);}
});

test('serviço desconhecido ou página quebrada na porta recebe orientação sem iniciar outra instância', async () => {
  const root = await fixture(); const expected = await instanceInfo(root, 'distribution');
  const server = http.createServer((req, res) => {
    if (req.url === '/api/instance') {res.writeHead(200, {'Content-Type': 'application/json'}); res.end(JSON.stringify(expected));}
    else {res.writeHead(404); res.end('not found');}
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port, url = `http://127.0.0.1:${port}`;
    assert.equal(await runningApp(url, expected), 'occupied');
    assert.equal(await openApp(root, {env: {SCRATCHES_PORT: String(port)}, log: () => {}, open: async () => assert.fail('não deve abrir página quebrada')}), 1);
  } finally {await new Promise(resolve => {server.close(resolve); server.closeAllConnections();}); await cleanFixture(root);}
});
