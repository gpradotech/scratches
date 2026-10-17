import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WorkspaceStore} from '../prototipos/02-exploracao-local/server/store.ts';
import {workspaceApi} from '../prototipos/02-exploracao-local/server/api.ts';
import {UpdateManager} from '../lib/updates.mjs';
import {updatesApi} from '../lib/updates-api.mjs';
import {feedbackApi} from '../lib/feedback-api.mjs';

const appPath='prototipos/02-exploracao-local';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
export async function createApp({root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),port=Number(process.env.SCRATCHES_PORT || 5174),updateOptions={},feedbackOptions={}}={}) {
  const store=new WorkspaceStore(path.join(root,'dados/prototipo-02/workspace.json'));
  await store.read(); // Um arquivo inválido não pode ser confirmado como início saudável.
  const dist=path.join(root,appPath,'dist');await fs.access(path.join(dist,'index.html'));
  let manager;
  const workspace=workspaceApi(store);
  const feedback=feedbackApi(feedbackOptions);
  const server=http.createServer(async(req,res)=>{
    const send=(status,text)=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});res.end(text);};
    try {
      await feedback(req,res,()=>{});if(res.writableEnded)return;
      await updatesApi(manager)(req,res,()=>{});if(res.writableEnded)return;
      store.blocked=manager.phase==='restarting';
      await workspace(req,res,()=>{});if(res.writableEnded)return;
      if(req.method!=='GET' && req.method!=='HEAD')return send(405,'Método não disponível.');
      const host=req.headers.host || '';
      if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host))return send(403,'Acesso local obrigatório.');
      const pathname=decodeURIComponent(new URL(req.url,'http://'+host).pathname);
      if(pathname==='/catalogo/catalogo.json') {
        // Catálogo pessoal é preservado e distribuído separadamente do código.
        for(const folder of [path.join(root,appPath,'public'),dist]) {
          try {const bytes=await fs.readFile(path.join(folder,'catalogo/catalogo.json'));res.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});return res.end(bytes);}catch(e){if(e.code!=='ENOENT')throw e;}
        }
        res.writeHead(200,{'Content-Type':types['.json'],'Cache-Control':'no-store'});return res.end(JSON.stringify({tracks:[],artists:[]}));
      }
      if(pathname.split('/').some(part=>part==='..' || part.startsWith('.')) || pathname.includes('\\') || pathname.includes('\0'))return send(404,'Página não encontrada.');
      const base=pathname.startsWith('/catalogo/')?path.join(root,appPath,'public'):dist;
      const file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(base+path.sep))return send(404,'Página não encontrada.');
      let bytes;
      try {bytes=await fs.readFile(file);}catch(e){if(e.code==='ENOENT' && pathname.startsWith('/catalogo/'))bytes=await fs.readFile(path.join(dist,pathname));else throw e;}
      res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(e){if(!res.headersSent)send(e.code==='ENOENT'?404:500,'Não foi possível abrir este conteúdo.');else res.end();}
  });
  manager=await new UpdateManager(root,{...updateOptions,busy:()=>store.busy || !!updateOptions.busy?.()}).init();
  try {await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}
  catch(e){manager.close();throw e;}
  return {server,store,updates:manager,url:`http://127.0.0.1:${server.address().port}`,async close(){manager.close();store.blocked=true;await store.idle();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});}};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  let app,closing=false;
  const shutdown=async(code=0)=>{if(closing)return;closing=true;await app?.close();process.exit(code);};
  try {
    app=await createApp({updateOptions:{onRestart:()=>shutdown(75)}});
    console.log(`Scratches disponível em ${app.url}`);
    process.send?.({type:'ready',version:app.updates.version});
    process.on('message',message=>{if(message?.type==='shutdown')void shutdown();if(message?.type==='update-confirmed')app.updates.phase='updated';});
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void shutdown());
  }catch{console.error('Não foi possível iniciar o Scratches. Confira se a porta está livre e se o build foi preparado. Seus dados foram preservados.');process.exitCode=1;}
}
