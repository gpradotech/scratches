import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const git = args => {try {return execFileSync('git', args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();} catch {return '';}};
const privateEmail = git(['config', '--global', '--get', 'user.email']);
const emails = privateEmail && !privateEmail.endsWith('@users.noreply.github.com') ? [privateEmail.toLowerCase()] : [];
const files = new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean));
async function addBuild(folder) {
  for (const entry of await fs.readdir(folder, {withFileTypes: true}).catch(() => [])) {
    const name = path.join(folder, entry.name);
    if (entry.isDirectory()) await addBuild(name); else if (entry.isFile()) files.add(name);
  }
}
await addBuild('app/dist');
const findings = [];
for (const name of files) {
  const bytes = await fs.readFile(name).catch(() => null);
  if (!bytes) continue;
  const text = bytes.toString('utf8').toLowerCase();
  if (emails.some(email => text.includes(email))) findings.push(name);
}
const history = process.argv.includes('--history');
const metadata = git(['log', ...(history ? ['--branches', '--tags'] : ['-1']), '--format=%ae%n%ce%n%B']).toLowerCase();
if (emails.some(email => metadata.includes(email))) findings.push(history ? 'metadados do histórico Git' : 'metadados do commit atual');
if (findings.length) {console.error('Endereço privado encontrado em: ' + findings.join(', ')); process.exitCode = 1;}
else console.log(`Verificação de privacidade aprovada: código, documentos, build e ${history ? 'metadados do histórico alcançável' : 'metadados do commit atual'} sem o endereço pessoal configurado nesta máquina.`);
