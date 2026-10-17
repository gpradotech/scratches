import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp, mkdir, copyFile, writeFile, rm} from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const php = process.env.PHP_BINARY || 'php';
const extensions = process.env.PHP_EXTENSION_DIR;
const temporary = await mkdtemp(path.join(os.tmpdir(), 'scratches-feedback-http-'));
const publicRoot = path.join(temporary, 'public');
const privateRoot = path.join(temporary, 'private');
await mkdir(publicRoot); await mkdir(privateRoot);
for (const file of ['index.php', 'receiver.php']) await copyFile(path.join(root, 'servicos/feedback/php', file), path.join(publicRoot, file));
const privateConfig = path.join(privateRoot, 'config.php');
const publicConfig = path.join(publicRoot, 'config.php');
const fakeConfig = '<?php return ["api_key" => "test-only-key", "from" => "service@example.test", "to" => "recipient@example.test"];';
await writeFile(privateConfig, fakeConfig);
await writeFile(publicConfig, fakeConfig);

async function verify(configFile, available) {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const args = ['-n', ...(extensions ? ['-d', 'extension_dir=' + extensions] : []), '-d', 'extension=mbstring', '-d', 'extension=curl', '-S', '127.0.0.1:' + port, '-t', publicRoot, path.join(publicRoot, 'index.php')];
  const child = spawn(php, args, {windowsHide: true, env: {...process.env, SCRATCHES_FEEDBACK_CONFIG: configFile}, stdio: ['ignore', 'ignore', 'pipe']});
  const exited = once(child, 'exit');
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('PHP server startup timeout')), 10000);
      child.once('error', error => {clearTimeout(timeout); reject(error);});
      child.stderr.on('data', bytes => {if (bytes.toString().includes('started')) {clearTimeout(timeout); resolve();}});
    });
    const url = 'http://127.0.0.1:' + port + '/api/feedback';
    const health = await fetch(url);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), {available});
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal(health.headers.get('x-content-type-options'), 'nosniff');
    const rejected = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{"to":"override@example.test"}'});
    assert.equal(rejected.status, available ? 400 : 503);
    const response = await rejected.text();
    assert.ok(!response.includes('test-only-key') && !response.includes('recipient@example.test'));
    const privateRequest = await fetch('http://127.0.0.1:' + port + '/config.php');
    assert.equal(privateRequest.status, 404);
    assert.ok(!(await privateRequest.text()).includes('test-only-key'));
  } finally {
    child.kill();
    await exited;
  }
}

try {
  await verify(privateConfig, true);
  await verify(publicConfig, false);
  console.log(JSON.stringify({phpHttpChecksPassed: true,publicConfigRefused: true,realEmailsSent: 0}));
} finally {
  if (path.dirname(path.resolve(temporary)) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('scratches-feedback-http-')) throw new Error('Unexpected cleanup directory');
  await rm(temporary, {recursive: true, force: true});
}
