import dns from 'node:dns/promises';
import net from 'node:net';
import https from 'node:https';
import tls from 'node:tls';
import {Readable} from 'node:stream';
// Usa as autoridades já confiáveis no Node e no sistema, também no servidor de desenvolvimento.
// A verificação da cadeia e do hostname continua obrigatória.
const trustedRoots=[...new Set([...tls.getCACertificates('default'),...tls.getCACertificates('system')])];

export function privateAddress(ip) {
  if (ip.toLowerCase().startsWith('::ffff:')) {
    const tail=ip.slice(7);if(net.isIP(tail)===4)return privateAddress(tail);
    const parts=tail.split(':');if(parts.length===2){const high=parseInt(parts[0],16),low=parseInt(parts[1],16);return privateAddress(`${high>>8}.${high&255}.${low>>8}.${low&255}`);}
    return true;
  }
  if (net.isIP(ip) === 4) {
    const [a,b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && b===168) || (a===100 && b>=64 && b<=127) || (a===198 && (b===18 || b===19));
  }
  return ip==='::' || ip==='::1' || /^(fc|fd|fe[89ab])/i.test(ip) || /^2001:db8:/i.test(ip);
}
async function resolvePublicURL(value) {
  const url = new URL(value);
  if (url.protocol!=='https:' || url.username || url.password || (url.port && url.port!=='443')) throw new Error('A fonte precisa usar HTTPS público, sem credenciais na URL.');
  const host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=net.isIP(host) ? [{address:host}] : await dns.lookup(host,{all:true});
  if (!addresses.length || addresses.some(({address})=>privateAddress(address))) throw new Error('Endereços locais e privados não são aceitos como fontes.');
  return {url,addresses};
}
export async function publicURL(value) {return (await resolvePublicURL(value)).url;}
export async function remote(value, {signal, timeout=30000, acceptStatuses=[], ...options}={}) {
  let target=await resolvePublicURL(value);
  const timed=AbortSignal.timeout(timeout);
  const combined=signal ? AbortSignal.any([signal,timed]) : timed;
  for(let count=0;count<6;count++) {
    const {url,addresses}=target;
    const pinned=addresses.find(a=>net.isIP(a.address)===4) || addresses[0];
    // Pin the validated DNS answer for this connection, preserving TLS hostname verification.
    const response=await new Promise((resolve,reject)=>{
      const request=https.request(url,{method:options.method || 'GET',signal:combined,agent:false,ca:trustedRoots,
        lookup:(_hostname,options,callback)=>options.all?callback(null,[{address:pinned.address,family:net.isIP(pinned.address)}]):callback(null,pinned.address,net.isIP(pinned.address)),
        headers:{'User-Agent':'scratches/0.1',...options.headers}},res=>{
          res.once('error',reject);
          try {
            const headers=new Headers();for(const [key,values] of Object.entries(res.headers))if(values!==undefined)for(const v of Array.isArray(values)?values:[values])headers.append(key,v);
            const empty=options.method?.toUpperCase()==='HEAD' || [204,205,304].includes(res.statusCode);
            const response=new Response(empty?null:Readable.toWeb(res),{status:res.statusCode,headers});
            if(empty)res.resume();
            resolve(response);
          } catch(error) {res.destroy();reject(error);}
        });request.on('error',reject);request.end();
    });
    if ([301,302,303,307,308].includes(response.status)) {
      const next=response.headers.get('location');
      await response.body?.cancel();
      if(!next) throw new Error('Redirecionamento sem destino.');
      target=await resolvePublicURL(new URL(next,url).href);
      continue;
    }
    if(!response.ok && !acceptStatuses.includes(response.status)) {
      await response.body?.cancel();
      throw new Error(`A fonte ${url.hostname} respondeu HTTP ${response.status}.`);
    }
    return response;
  }
  throw new Error('A fonte excedeu o limite de redirecionamentos.');
}
export async function smallBody(response, max=8*1024*1024) {
  const chunks=[];let bytes=0;
  for await(const chunk of response.body) {bytes+=chunk.length;if(bytes>max)throw new Error('Resposta de metadados excessivamente grande.');chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks).toString('utf8');
}
export async function jsonURL(url,options={}) { return JSON.parse(await smallBody(await remote(url,options))); }
