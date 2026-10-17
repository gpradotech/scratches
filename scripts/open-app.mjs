import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {instanceInfo} from '../lib/app-instance.mjs';

const exists = name => fs.access(name).then(() => true, error => {if (error.code === 'ENOENT') return false; throw error;});
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function runningApp(url, expected) {
  try {
    const response = await fetch(url + '/api/instance', {signal: AbortSignal.timeout(1200), redirect: 'error'});
    if (!response.ok) return 'occupied';
    const body = await response.text();
    if (body.length > 4096) return 'occupied';
    const info = JSON.parse(body);
    if (info.app !== 'scratches' || info.installationId !== expected.installationId || info.version !== expected.version || info.mode !== expected.mode) return 'occupied';
    const page = await fetch(url + '/', {signal: AbortSignal.timeout(1200), redirect: 'error'});
    return page.ok ? 'ready' : 'occupied';
  } catch (error) {
    return error.cause?.code === 'ECONNREFUSED' ? 'free' : 'occupied';
  }
}

export async function openBrowser(url) {
  const [command, args] = process.platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {stdio: 'ignore', windowsHide: true});
    child.once('error', reject); child.once('spawn', () => {child.unref(); resolve();});
  });
}

export async function openApp(root, {env = process.env, open = openBrowser, log = console.log} = {}) {
  const version = process.versions.node.split('.').map(Number);
  if (version[0] < 22 || version[0] === 22 && version[1] < 19) {log('Instale o Node.js 22.19 ou superior e abra o Scratches novamente.'); return 1;}
  const port = Number(env.SCRATCHES_PORT || 5174);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {log('A porta configurada para o Scratches é inválida.'); return 1;}
  root = await fs.realpath(root);
  const development = await exists(path.join(root, '.git'));
  const expected = await instanceInfo(root, development ? 'development' : 'distribution');
  const url = `http://127.0.0.1:${port}`;
  const show = async () => {
    log(`Abra ${url} no navegador.`);
    if (env.SCRATCHES_OPEN !== '0') try {await open(url);} catch {log('Não foi possível abrir o navegador automaticamente. Use o endereço acima.');}
  };
  const current = await runningApp(url, expected);
  if (current === 'ready') {log('O Scratches desta pasta já está aberto. Use a janela existente para encerrar com Ctrl+C.'); await show(); return 0;}
  if (current === 'occupied') {
    log(`A porta ${port} está sendo usada por outro programa ou por uma instância antiga do Scratches.`);
    log('Encerre a janela da outra instância e abra iniciar-app.cmd novamente. Seus dados foram preservados.');
    return 1;
  }
  const runNode = (args, ipc = false) => spawn(process.execPath, ['--use-system-ca', ...args], {cwd: root, env, windowsHide: true, stdio: ipc ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit'});
  let child;
  if (development) {
    const vite = path.join(root, 'node_modules/vite/bin/vite.js');
    if (!await exists(vite)) {log('As dependências ainda não foram instaladas. Execute npm ci nesta pasta ou use o ZIP pronto indicado no README.'); return 1;}
    const prepared = runNode([path.join(root, 'app/scripts/preparar-catalogo.mjs')]);
    const code = await new Promise(resolve => {prepared.once('error', () => resolve(1)); prepared.once('exit', resolve);});
    if (code !== 0) {log('Não foi possível preparar o catálogo. Seus dados foram preservados.'); return 1;}
    child = runNode([vite, path.join(root, 'app'), '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
  } else {
    if (!await exists(path.join(root, 'app/dist/index.html'))) {log('Não encontramos todos os arquivos do Scratches. Extraia o ZIP inteiro indicado no README e tente novamente.'); return 1;}
    child = runNode([path.join(root, 'scripts/run.mjs')], true);
  }
  let settled = false, stopping = false;
  const exited = new Promise(resolve => {
    child.once('error', () => {settled = true; log('Não foi possível iniciar o Scratches. Seus dados foram preservados.'); resolve(1);});
    child.once('exit', code => {settled = true; resolve(stopping ? 0 : code ?? 1);});
  });
  const stop = () => {stopping = true; if (!settled) {if (child.connected) child.send({type: 'shutdown'}); else child.kill('SIGTERM');}};
  const message = value => {if (value?.type === 'shutdown') stop();};
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  process.on('message', message); process.on('disconnect', stop);
  try {
    const deadline = Date.now() + 30000;
    while (!settled && Date.now() < deadline) {
      if (await runningApp(url, expected) === 'ready') {log('Scratches pronto. Mantenha esta janela aberta; encerre com Ctrl+C.'); await show(); return await exited;}
      await pause(200);
    }
    if (!settled) {log('O Scratches não ficou pronto. Confira a mensagem acima e tente novamente.'); stop();}
    return await exited;
  } finally {process.off('SIGINT', stop); process.off('SIGTERM', stop); process.off('message', message); process.off('disconnect', stop);}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {process.exitCode = await openApp(root);} catch {console.error('Não foi possível abrir o Scratches. Seus dados foram preservados.'); process.exitCode = 1;}
}
