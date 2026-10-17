import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {decodePackage,safeTarget,sha256,managedPath,newerVersion} from './update-package.mjs';

const exists=async file=>{try{await fs.lstat(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}};
export async function updateHome(root) {
  let directory=await fs.realpath(root);
  for(const name of ['.scratches','updates']) {
    directory=path.join(directory,name);
    if(await exists(directory)){const stat=await fs.lstat(directory);if(stat.isSymbolicLink() || !stat.isDirectory())throw new Error('Não conseguimos acessar a pasta de atualização com segurança.');}
    else await fs.mkdir(directory);
  }
  return directory;
}
export async function readJSON(file,fallback=null) {
  try{if((await fs.lstat(file)).isSymbolicLink())throw new Error('Arquivo de atualização inválido.');return JSON.parse(await fs.readFile(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return fallback;throw error;}
}
export async function writeJSON(file,data) {
  const temporary=`${file}.${randomUUID()}.tmp`;
  await fs.writeFile(temporary,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});
  await fs.rename(temporary,file);
}
async function jobFolder(home,id) {
  if(!/^[a-f0-9-]{36}$/.test(id || ''))throw new Error('Não conseguimos validar a atualização preparada.');
  const directory=path.join(home,id);
  if((await fs.lstat(directory)).isSymbolicLink())throw new Error('Não conseguimos acessar a atualização preparada.');
  return directory;
}
export async function prepareUpdate(root,compressed,{version,digest}) {
  decodePackage(compressed,{version,digest});
  const home=await updateHome(root),id=randomUUID(),directory=path.join(home,id);
  await fs.mkdir(directory);await fs.writeFile(path.join(directory,'package.gz'),compressed,{flag:'wx',mode:0o600});
  const job={id,version,digest};await writeJSON(path.join(home,'pending.json'),job);return job;
}
function dependencies(lock) {
  const data=structuredClone(lock);delete data.version;if(data.packages?.[''])delete data.packages[''].version;
  return sha256(JSON.stringify(data));
}
async function workspaceFile(root) {
  let target=root;
  for(const name of ['dados','prototipo-02','workspace.json']) {
    target=path.join(target,name);
    if(await exists(target) && (await fs.lstat(target)).isSymbolicLink())throw new Error('Não conseguimos acessar seus dados com segurança.');
  }
  return target;
}
async function installDependencies(stage,cache) {
  const nodeDirectory=path.dirname(process.execPath);
  const candidates=[path.join(nodeDirectory,'node_modules/npm/bin/npm-cli.js'),path.resolve(nodeDirectory,'../lib/node_modules/npm/bin/npm-cli.js')];
  for(const directory of (process.env.PATH || '').split(path.delimiter))for(const name of ['npm','npm-cli.js']) {
    try{const resolved=await fs.realpath(path.join(directory,name));if(resolved.endsWith('npm-cli.js'))candidates.push(resolved);}catch{}
  }
  let cli;for(const candidate of candidates)if(await exists(candidate)){cli=candidate;break;}
  if(!cli)throw new Error('Não conseguimos localizar o npm. Reinstale o Node.js para atualizar o aplicativo.');
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--use-system-ca',cli,'ci','--no-audit','--no-fund','--cache',cache],{cwd:stage,windowsHide:true,timeout:300000,env:{...process.env,NODE_OPTIONS:'--use-system-ca'},stdio:'ignore'});
    child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('Não conseguimos preparar as dependências. A versão anterior foi preservada.')));
  });
  await fs.mkdir(path.join(stage,'node_modules'),{recursive:true});
}
export async function applyPreparedUpdate(root,{install=installDependencies}={}) {
  root=await fs.realpath(root);
  if(await exists(path.join(root,'.git')))throw new Error('Esta cópia de desenvolvimento deve ser atualizada pelo Git. Use a instalação extraída do ZIP para atualizar pelo aplicativo.');
  const home=await updateHome(root),job=await readJSON(path.join(home,'pending.json'));
  if(!job)throw new Error('Não conseguimos encontrar uma atualização preparada.');
  const directory=await jobFolder(home,job.id),packageFile=path.join(directory,'package.gz');
  if((await fs.lstat(packageFile)).isSymbolicLink())throw new Error('Pacote de atualização inválido.');
  const data=decodePackage(await fs.readFile(packageFile),job);
  const currentPackage=await readJSON(path.join(root,'package.json'));
  if(!newerVersion(data.version,currentPackage?.version))throw new Error('Esta atualização não é mais recente que a versão instalada. Verifique novamente.');
  const previous=await readJSON(path.join(home,'installed.json'),{files:[]});
  const stage=path.join(directory,'stage'),backup=path.join(directory,'backup');
  await fs.mkdir(stage);await fs.mkdir(backup);
  const workspace=await workspaceFile(root);let workspaceHash=null;
  if(await exists(workspace)){const bytes=await fs.readFile(workspace);workspaceHash=sha256(bytes);await fs.writeFile(path.join(directory,'workspace.backup'),bytes,{flag:'wx',mode:0o600});}
  const targets=new Map(data.files.map(file=>[file.path,file]));
  for(const file of previous.files || []){if(!managedPath(file.path))throw new Error('Registro de instalação inválido.');if(!targets.has(file.path))targets.set(file.path,null);}
  const changes=[];
  for(const [name,file] of targets) {
    const target=await safeTarget(root,name);let oldHash=null,oldMode=0o644;
    if(await exists(target)) {
      const stat=await fs.lstat(target);if(!stat.isFile())throw new Error('Não conseguimos substituir um arquivo da instalação.');
      const content=await fs.readFile(target);oldHash=sha256(content);oldMode=stat.mode&0o777;
      const known=previous.files?.find(item=>item.path===name);
      if(known && known.sha256!==oldHash)throw new Error('Os arquivos do aplicativo foram modificados. Preserve suas alterações antes de atualizar manualmente.');
      const saved=await safeTarget(backup,name);await fs.mkdir(path.dirname(saved),{recursive:true});await fs.writeFile(saved,content,{flag:'wx'});
    }
    if(file){const staged=await safeTarget(stage,name);await fs.mkdir(path.dirname(staged),{recursive:true});await fs.writeFile(staged,Buffer.from(file.content,'base64'),{flag:'wx',mode:file.mode});await fs.chmod(staged,file.mode);}
    changes.push({path:name,oldHash,oldMode,newHash:file?.sha256 || null});
  }
  const newLock=JSON.parse(await fs.readFile(path.join(stage,'package-lock.json'),'utf8'));
  const oldLock=await readJSON(path.join(root,'package-lock.json'),{});
  const modules=path.join(root,'node_modules'),hadModules=await exists(modules);
  if(hadModules && (await fs.lstat(modules)).isSymbolicLink())throw new Error('Não conseguimos atualizar uma instalação com dependências em atalho.');
  const replaceModules=!hadModules || dependencies(newLock)!==dependencies(oldLock);
  if(replaceModules)await install(stage,path.join(root,'.scratches','npm-cache'));
  const journal={id:job.id,version:job.version,status:'applying',changes,replaceModules,hadModules,workspaceHash,previousInstall:previous,files:data.files.map(({path,sha256})=>({path,sha256}))};
  await writeJSON(path.join(home,'journal.json'),journal);
  try {
    if(replaceModules){if(hadModules)await fs.rename(modules,path.join(backup,'node_modules'));await fs.rename(path.join(stage,'node_modules'),modules);}
    for(const change of changes) {
      const destination=await safeTarget(root,change.path);
      if(change.newHash){await fs.mkdir(path.dirname(destination),{recursive:true});await fs.rename(await safeTarget(stage,change.path),destination);}
      else if(change.oldHash)await fs.unlink(destination);
    }
    journal.status='awaiting-health';await writeJSON(path.join(home,'journal.json'),journal);
    return journal;
  }catch(error){await rollbackUpdate(root,'Não conseguimos concluir a instalação. A versão anterior foi restaurada.');throw error;}
}
export async function rollbackUpdate(root,message='A atualização não iniciou corretamente. A versão anterior foi restaurada.') {
  root=await fs.realpath(root);const home=await updateHome(root),journal=await readJSON(path.join(home,'journal.json'));
  if(journal && ['applying','awaiting-health'].includes(journal.status)) {
    const directory=await jobFolder(home,journal.id),backup=path.join(directory,'backup');
    for(const change of [...journal.changes].reverse()) {
      const target=await safeTarget(root,change.path),current=await exists(target)?sha256(await fs.readFile(target)):null;
      if(current!==change.oldHash && current!==change.newHash)throw new Error('Não conseguimos restaurar um arquivo que foi modificado durante a atualização. Os backups foram preservados.');
      if(change.oldHash){const saved=await safeTarget(backup,change.path),content=await fs.readFile(saved);if(sha256(content)!==change.oldHash)throw new Error('Backup de atualização inválido.');await fs.mkdir(path.dirname(target),{recursive:true});const temporary=`${target}.${randomUUID()}.tmp`;await fs.writeFile(temporary,content,{flag:'wx',mode:change.oldMode});await fs.rename(temporary,target);}
      else if(current)await fs.unlink(target);
    }
    if(journal.replaceModules) {
      const modules=path.join(root,'node_modules'),saved=path.join(backup,'node_modules');
      if(await exists(saved)) {if(await exists(modules))await fs.rename(modules,path.join(directory,'failed-node_modules'));await fs.rename(saved,modules);}
      else if(!journal.hadModules && await exists(modules))await fs.rename(modules,path.join(directory,'failed-node_modules'));
    }
    const target=await workspaceFile(root);
    if(journal.workspaceHash){const bytes=await fs.readFile(path.join(directory,'workspace.backup'));if(sha256(bytes)!==journal.workspaceHash)throw new Error('Backup dos projetos e letras inválido.');await fs.mkdir(path.dirname(target),{recursive:true});const temporary=path.join(home,`workspace-${randomUUID()}.tmp`);await fs.writeFile(temporary,bytes,{flag:'wx',mode:0o600});await fs.rename(temporary,target);}
    else if(await exists(target))await fs.rename(target,path.join(directory,'workspace-from-failed-version.json'));
    await writeJSON(path.join(home,'installed.json'),journal.previousInstall || {files:[]});
    journal.status='rolled-back';await writeJSON(path.join(home,'journal.json'),journal);
  }
  await fs.unlink(path.join(home,'pending.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
  await writeJSON(path.join(home,'result.json'),{phase:'restored',message,at:Date.now()});
}
export async function confirmUpdate(root) {
  const home=await updateHome(root),journal=await readJSON(path.join(home,'journal.json'));
  if(!journal || journal.status!=='awaiting-health')return;
  await writeJSON(path.join(home,'installed.json'),{version:journal.version,files:journal.files});
  journal.status='committed';await writeJSON(path.join(home,'journal.json'),journal);
  await fs.unlink(path.join(home,'pending.json')).catch(()=>{});
  await writeJSON(path.join(home,'result.json'),{phase:'updated',version:journal.version,at:Date.now()}).catch(()=>{});
}
export async function recoverUpdate(root) {
  const home=await updateHome(root),journal=await readJSON(path.join(home,'journal.json'));
  if(journal && ['applying','awaiting-health'].includes(journal.status))await rollbackUpdate(root);
}
