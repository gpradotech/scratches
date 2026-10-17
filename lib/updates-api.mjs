export function updatesApi(manager) {
  return async(req,res,next)=>{
    const route=req.url?.split('?')[0];
    if(!route?.startsWith('/api/updates'))return next();
    const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
    const host=req.headers.host || '',origin=req.headers.origin,remote=req.socket.remoteAddress;
    if(!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !['127.0.0.1','::1','::ffff:127.0.0.1'].includes(remote) || origin && origin!=='http://'+host || req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'Acesso permitido apenas pelo aplicativo local.'});
    try {
      if(route==='/api/updates' && req.method==='GET')return send(200,manager.view());
      if(req.method!=='POST')return send(405,{error:'Método não disponível.'});
      if(req.headers['x-scratches-update']!=='1' || !req.headers['content-type']?.startsWith('application/json'))return send(403,{error:'Abra a atualização pelo Scratches.'});
      const chunks=[];let size=0;
      for await(const chunk of req){size+=chunk.length;if(size>4096)return send(413,{error:'Solicitação muito grande.'});chunks.push(Buffer.from(chunk));}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Solicitação inválida.'});}
      if(!data || typeof data!=='object' || Array.isArray(data) || Object.keys(data).some(key=>!['version','clientId','safe'].includes(key)))return send(400,{error:'Solicitação inválida.'});
      if(route==='/api/updates/check')return send(200,await manager.check({manual:true}));
      if(route==='/api/updates/heartbeat')return send(200,manager.heartbeat(data.clientId,data.safe));
      if(route==='/api/updates/leave'){manager.clients.delete(data.clientId);return send(200,{ok:true});}
      if(route==='/api/updates/dismiss')return send(200,await manager.dismiss(data.version));
      if(route==='/api/updates/install')return send(200,await manager.start(data.version));
      if(route==='/api/updates/cancel')return send(200,await manager.cancel());
      return send(404,{error:'Ação não encontrada.'});
    }catch(e){return send(400,{error:e.message || 'Não foi possível concluir a atualização.'});}
  };
}
