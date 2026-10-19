import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';

export const MAX_PACKAGE_BYTES=32*1024*1024;
const MAX_CONTENT_BYTES=96*1024*1024;
const app='app';
const legacyApp='prototipos/02-exploracao-local';
const top=new Set(['README.md','package.json','package-lock.json','start.command','iniciar-app.cmd','scripts/open-app.mjs','scripts/run.mjs','scripts/serve.mjs','docs/ATUALIZACOES.md',`${app}/server/api.ts`,`${app}/server/store.ts`,`${app}/server/music.ts`,`${app}/src/domain/model.ts`]);
const roots=new Set(['lib',`${app}/dist`]);
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function versionParts(value){const match=String(value).match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);return match?match.slice(1).map(Number):null;}
export function newerVersion(candidate,current){const a=versionParts(candidate),b=versionParts(current);if(!a || !b)return false;for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;}
export function managedPath(name) {
  if(typeof name!=='string' || name.length>240 || name.includes('\\') || name.includes(':') || /[\x00-\x1f]/.test(name))return false;
  const parts=name.split('/');
  if(parts.some(part=>!part || part==='.' || part==='..' || /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)))return false;
  if(parts.some(part=>/^\.(?:git|scratches|env)(?:$|\.)/i.test(part)) && !top.has(name))return false;
  if(/\.(flac|wav|mp3|m4a|ogg|part)$/i.test(name))return false;
  if(parts.some(part=>['node_modules','catalogo','dados','pesquisa','planejamento','coverage'].includes(part.toLowerCase())) || /\.(?:test|spec)\./i.test(name) || /\.map$/i.test(name))return false;
  return top.has(name) || name==='iniciar-prototipo.cmd' || ['server/api.ts','server/store.ts','src/domain/model.ts'].some(file=>name===`${legacyApp}/${file}`) || name.startsWith('lib/') || name.startsWith(`${app}/dist/`) || name.startsWith(`${legacyApp}/dist/`);
}
export async function safeTarget(root,name) {
  if(!managedPath(name))throw new Error('Não conseguimos validar os arquivos da atualização.');
  let current=root;
  for(const part of name.split('/')) {
    current=path.join(current,part);
    try{const stat=await fs.lstat(current);if(stat.isSymbolicLink())throw new Error('Não conseguimos atualizar uma instalação com atalhos nos arquivos do aplicativo.');}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return current;
}
export function decodePackage(compressed,{digest,version}={}) {
  if(compressed.length>MAX_PACKAGE_BYTES || !/^[a-f0-9]{64}$/.test(digest || '') || sha256(compressed)!==digest)throw new Error('Não conseguimos confirmar a integridade da atualização. Tente novamente.');
  let data;try{data=JSON.parse(gunzipSync(compressed,{maxOutputLength:MAX_CONTENT_BYTES}).toString('utf8'));}catch{throw new Error('Não conseguimos abrir o pacote de atualização.');}
  if(data.format!==1 || data.version!==version || !versionParts(data.version) || !Array.isArray(data.files) || data.files.length<5 || data.files.length>2000)throw new Error('Não conseguimos validar esta versão do aplicativo.');
  const names=new Set(),caseNames=new Set();let bytes=0;
  for(const file of data.files) {
    if(!managedPath(file.path) || caseNames.has(file.path.toLowerCase()) || ![0o644,0o755].includes(file.mode) || typeof file.content!=='string' || !/^[a-f0-9]{64}$/.test(file.sha256 || ''))throw new Error('Não conseguimos validar os arquivos da atualização.');
    const content=Buffer.from(file.content,'base64');bytes+=content.length;
    if(content.toString('base64')!==file.content || bytes>MAX_CONTENT_BYTES || sha256(content)!==file.sha256)throw new Error('Não conseguimos confirmar a integridade dos arquivos da atualização.');
    names.add(file.path);caseNames.add(file.path.toLowerCase());
  }
  const layout=names.has(`${app}/dist/index.html`)?app:legacyApp;
  for(const required of ['package.json','package-lock.json','scripts/serve.mjs','scripts/run.mjs','lib/update-installer.mjs',`${layout}/dist/index.html`,`${layout}/server/api.ts`,`${layout}/server/store.ts`,layout===app?`${app}/server/music.ts`:'lib/music.ts',`${layout}/src/domain/model.ts`])if(!names.has(required))throw new Error('Não conseguimos encontrar todos os arquivos da atualização.');
  const json=name=>JSON.parse(Buffer.from(data.files.find(file=>file.path===name).content,'base64').toString('utf8'));
  const pkg=json('package.json'),lock=json('package-lock.json');
  if(pkg.name!=='scratches' || pkg.version!==version || lock.version!==version || lock.packages?.['']?.version!==version || data.runnerProtocol!==1)throw new Error('Não conseguimos confirmar a versão do pacote de atualização.');
  const minimum=pkg.engines?.node?.match(/^>=(\d+\.\d+\.\d+)$/)?.[1];
  if(!minimum || newerVersion(minimum,process.versions.node))throw new Error('Esta atualização precisa de uma versão mais recente do Node.js. Atualize o Node.js antes de continuar.');
  return data;
}
export async function buildPackage(root,{legacyCompatible=false}={}) {
  const files=[];
  const sourcePackage=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  const production=Array.isArray(sourcePackage.workspaces);
  const runtimePackage={name:'scratches',version:sourcePackage.version,private:true,type:'module',scripts:{start:'node --use-system-ca scripts/open-app.mjs'},engines:sourcePackage.engines};
  const runtimeLock={name:'scratches',version:sourcePackage.version,lockfileVersion:3,requires:true,packages:{'':{name:'scratches',version:sourcePackage.version,engines:sourcePackage.engines}}};
  async function add(name) {
    const target=roots.has(name)?path.join(root,name):await safeTarget(root,name),stat=await fs.lstat(target);
    if(stat.isSymbolicLink())throw new Error('O pacote não pode conter atalhos.');
    if(stat.isDirectory()){for(const entry of (await fs.readdir(target)).sort()){const child=`${name}/${entry}`;if(managedPath(child))await add(child);}return;}
    if(!stat.isFile())throw new Error('O pacote só pode conter arquivos comuns.');
    let content=await fs.readFile(target);
    // O frontend já está compilado e o servidor usa apenas módulos do Node.
    // A distribuição não precisa dos workspaces e ferramentas de desenvolvimento.
    if(production && name==='package.json')content=Buffer.from(JSON.stringify(runtimePackage,null,2)+'\n');
    if(production && name==='package-lock.json')content=Buffer.from(JSON.stringify(runtimeLock,null,2)+'\n');
    if(production && name==='README.md') {
      const instructions=await fs.realpath(path.join(root,'docs/INSTALACAO.md'));
      if(!instructions.startsWith((await fs.realpath(root))+path.sep))throw new Error('As instruções de distribuição estão fora do projeto.');
      content=await fs.readFile(instructions);
    }
    files.push({path:name,mode:name==='start.command'?0o755:0o644,sha256:sha256(content),content:content.toString('base64')});
  }
  for(const name of [...top,...roots].sort())try{await add(name);}catch(error){if(error.code!=='ENOENT')throw error;}
  const version=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8')).version;
  if(legacyCompatible) {
    // v0.1.0 only permits its original runtime paths and lib/. Keep its
    // security boundary intact while distributing the current application.
    for(const file of files) {
      const original=file.path;
      let content=Buffer.from(file.content,'base64');
      if(original===`${app}/server/music.ts`)file.path='lib/music.ts';
      else if(original.startsWith(`${app}/`))file.path=legacyApp+original.slice(app.length);
      else if(original==='scripts/open-app.mjs')file.path='lib/open-app.mjs';
      else if(original==='iniciar-app.cmd')file.path='iniciar-prototipo.cmd';
      if(!original.startsWith(`${app}/dist/`) && original!=='lib/update-package.mjs' && /\.(?:mjs|ts|cmd|command|json)$/.test(original)) {
        let text=content.toString('utf8').replaceAll('../app/',`../${legacyApp}/`).replaceAll("'app/",`'${legacyApp}/`).replaceAll("'app'",`'${legacyApp}'`).replaceAll('scripts/open-app.mjs','lib/open-app.mjs');
        if(original==='scripts/serve.mjs')text=text.replace(`../${legacyApp}/server/music.ts`,'../lib/music.ts');
        if(original===`${app}/server/music.ts`)text=text.replaceAll('../src/domain/',`../${legacyApp}/src/domain/`);
        content=Buffer.from(text);
      }
      file.content=content.toString('base64');file.sha256=sha256(content);
    }
  }
  const compressed=gzipSync(JSON.stringify({format:1,runnerProtocol:1,version,files}),{level:9});
  const digest=sha256(compressed);decodePackage(compressed,{digest,version});
  return {version,compressed,digest,files:files.length};
}
