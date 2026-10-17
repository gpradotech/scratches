import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {applyPreparedUpdate,confirmUpdate,recoverUpdate,rollbackUpdate} from '../lib/update-installer.mjs';

export async function runApplication(root,{env=process.env,readyTimeout=30000}={}) {
  await recoverUpdate(root);
  let stopping=false,child,updating=false,expectedVersion=null,open=env.SCRATCHES_OPEN;
  const stop=()=>{stopping=true;if(child?.connected)child.send({type:'shutdown'});};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try {
    while(true) {
      if(stopping)return 0;
      const outcome=await new Promise((resolve,reject)=>{
        let ready=false,timer,settled=false,health=Promise.resolve(),healthError;
        child=spawn(process.execPath,['--use-system-ca',path.join(root,'scripts/serve.mjs')],{cwd:root,windowsHide:true,env:{...env,SCRATCHES_MANAGED_RUNNER:'1',SCRATCHES_UPDATE_BOOT:updating?'1':'0',SCRATCHES_OPEN:open || '0'},stdio:['inherit','inherit','inherit','ipc']});
        if(updating)timer=setTimeout(()=>{if(child.connected)child.send({type:'shutdown'});child.kill();},readyTimeout);
        child.on('message',message=>{
          if(message?.type!=='ready' || ready || (updating && message.version!==expectedVersion))return;
          ready=true;clearTimeout(timer);
          if(updating)health=confirmUpdate(root).then(()=>{if(child.connected)child.send({type:'update-confirmed'});}).catch(error=>{healthError=error;child.kill();});
        });
        child.on('error',error=>{clearTimeout(timer);if(!settled){settled=true;reject(error);}});
        child.on('exit',(code,signal)=>{clearTimeout(timer);if(!settled){settled=true;health.then(()=>resolve({code,signal,ready:ready && !healthError}),reject);}});
      });
      open='0';
      if(updating && !outcome.ready) {
        await rollbackUpdate(root);updating=false;expectedVersion=null;
        console.log('A atualização não iniciou. A versão anterior foi restaurada.');if(stopping)return 0;continue;
      }
      updating=false;expectedVersion=null;
      if(stopping || outcome.code!==75)return outcome.code || 0;
      try{const journal=await applyPreparedUpdate(root);updating=true;expectedVersion=journal.version;}
      catch{await rollbackUpdate(root,'Não conseguimos instalar a atualização. A versão anterior foi preservada.');console.log('Não foi possível atualizar. Abrindo a versão anterior.');}
    }
  }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  try{process.exitCode=await runApplication(root);}catch{console.error('Não conseguimos iniciar o aplicativo. Os dados e os backups foram preservados.');process.exitCode=1;}
}
