import fs from 'node:fs/promises';
import path from 'node:path';
import {remote,smallBody} from './update-net.mjs';
import {newerVersion,MAX_PACKAGE_BYTES} from './update-package.mjs';
import {prepareUpdate,updateHome,readJSON,writeJSON} from './update-installer.mjs';

export const RELEASE_REPOSITORY='gpradotech/scratches';
export const RELEASE_API=`https://api.github.com/repos/${RELEASE_REPOSITORY}/releases/latest`;
export const CHECK_INTERVAL=6*60*60*1000;
const activePhases=['downloading','waiting-work','restarting'];
export function releaseCandidate(data,current) {
  if(!data || data.draft || data.prerelease || !/^v\d+\.\d+\.\d+$/.test(data.tag_name || '') || !newerVersion(data.tag_name,current))return null;
  const version=data.tag_name.slice(1),name=`scratches-${version}.update.json.gz`;
  const asset=data.assets?.find(item=>item.name===name && item.state==='uploaded');
  const url=`https://github.com/${RELEASE_REPOSITORY}/releases/download/v${version}/${name}`;
  if(!asset || asset.browser_download_url!==url || !/^sha256:[a-f0-9]{64}$/.test(asset.digest || '') || !Number.isSafeInteger(asset.size) || asset.size<1 || asset.size>MAX_PACKAGE_BYTES)return null;
  return {version,url,digest:asset.digest.slice(7),bytes:asset.size,notes:String(data.body || '').slice(0,4000)};
}
function retryDelay(headers,now) {
  const value=headers.get('retry-after');
  const after=value && /^\d+$/.test(value)?Number(value)*1000:Math.max(0,Date.parse(value || '')-now);
  const reset=Number(headers.get('x-ratelimit-reset'))*1000;
  return Math.max(now+60000,now+(Number.isFinite(after)?after:0),Number.isFinite(reset)?reset:0);
}
export class UpdateManager {
  constructor(root,{request=remote,now=Date.now,autoCheck=process.env.SCRATCHES_UPDATE_CHECKS!=='0',managed=process.env.SCRATCHES_MANAGED_RUNNER==='1',busy=()=>Boolean(false),onRestart}={}) {
    Object.assign(this,{root,request,now,autoCheck,managed,onRestart,isBusy:busy});
    this.enabled=false;this.phase='idle';this.progress=0;this.available=null;this.checkedAt=null;this.checkError='';this.error='';this.checking=false;this.nextCheckAt=0;this.retryCheckAt=0;this.prefs={};this.closed=false;this.clients=new Map();
  }
  async init() {
    const pkg=await readJSON(path.join(this.root,'package.json'));
    if(pkg?.name!=='scratches')return this;
    this.root=await fs.realpath(this.root);this.version=pkg.version;this.home=await updateHome(this.root);this.enabled=true;
    this.prefs=await readJSON(path.join(this.home,'preferences.json'),{});
    this.checkedAt=this.prefs.checkedAt || null;this.nextCheckAt=this.prefs.nextCheckAt || 0;this.retryCheckAt=this.prefs.retryCheckAt || 0;
    this.available=releaseCandidate(this.prefs.release,this.version);
    const result=await readJSON(path.join(this.home,'result.json'));
    if(result?.phase==='restored'){this.phase='restored';this.error=result.message;}
    else if(result?.phase==='updated' && result.version===this.version)this.phase='updated';
    if(process.env.SCRATCHES_UPDATE_BOOT==='1')this.phase='restarting';
    this.gitCopy=await fs.lstat(path.join(this.root,'.git')).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
    if(this.autoCheck){this.timer=setInterval(()=>{if(this.now()>=this.nextCheckAt)this.check().catch(()=>{});},60000);this.timer.unref();this.check().catch(()=>{});}
    return this;
  }
  heartbeat(id,safe) {
    if(!/^[a-zA-Z0-9-]{16,80}$/.test(id || '') || typeof safe!=='boolean')throw new Error('Sessão de atualização inválida.');
    if(!this.clients.has(id) && this.clients.size>=100)throw new Error('Há muitas janelas abertas. Feche as que não estiver usando.');
    this.clients.set(id,{safe,at:this.now()});
    if(!safe && this.phase==='restarting'){clearTimeout(this.restartTimer);this.phase='waiting-work';this.waitTimer=setInterval(()=>this.maybeRestart().catch(()=>{}),500);this.waitTimer.unref();}
    return this.view();
  }
  busy() {
    for(const [id,client] of this.clients)if(client.safe && this.now()-client.at>15000)this.clients.delete(id);
    return this.isBusy() || [...this.clients.values()].some(client=>!client.safe);
  }
  view() {
    return {enabled:this.enabled,currentVersion:this.version || null,available:this.available?{version:this.available.version,notes:this.available.notes}:null,checkedAt:this.checkedAt,checking:this.checking,checkError:this.checkError,hasRelease:!!this.prefs.release,phase:this.phase,progress:this.progress,error:this.error,dismissedVersion:this.prefs.dismissedVersion || null,busy:this.busy(),canInstall:!!(this.managed && !this.gitCopy && this.onRestart),installNotice:this.gitCopy?'Esta cópia de desenvolvimento é atualizada pelo Git. A instalação pelo aplicativo fica disponível nas cópias de distribuição.':!this.managed?'Abra o Scratches pelo inicializador para habilitar a atualização com reinício automático.':''};
  }
  async check({manual=false}={}) {
    if(!this.enabled || this.closed || this.checking || activePhases.includes(this.phase))return this.view();
    if(this.now()<this.retryCheckAt){this.checkError='O serviço de atualizações pediu uma pausa. Tente novamente mais tarde.';return this.view();}
    if(this.now()<this.nextCheckAt && (!manual || this.now()-(this.checkedAt || 0)<60000))return this.view();
    this.checking=true;this.checkError='';
    if(manual && ['updated','restored','error'].includes(this.phase)){this.phase='idle';this.error='';}
    try {
      const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
      if(this.prefs.etag && !/[\r\n]/.test(this.prefs.etag))headers['If-None-Match']=this.prefs.etag;
      const response=await this.request(RELEASE_API,{timeout:15000,headers,acceptStatuses:[304,404,403,429]});
      this.checkedAt=this.now();this.nextCheckAt=this.now()+CHECK_INTERVAL;
      if([403,429].includes(response.status)) {
        this.retryCheckAt=this.nextCheckAt=retryDelay(response.headers,this.now());
        this.checkError='O serviço de atualizações pediu uma pausa. Tente novamente mais tarde.';await response.body?.cancel();
      }else if(response.status===404){this.available=null;this.prefs.release=null;delete this.prefs.etag;await response.body?.cancel();}
      else if(response.status===304){this.available=releaseCandidate(this.prefs.release,this.version);if(newerVersion(this.prefs.release?.tag_name,this.version) && !this.available)this.checkError='A versão publicada ainda não tem um pacote de atualização válido. Tente novamente mais tarde.';await response.body?.cancel();}
      else {
        const data=JSON.parse(await smallBody(response,2*1024*1024));
        this.available=releaseCandidate(data,this.version);this.prefs.release=data;this.prefs.etag=response.headers.get('etag')?.slice(0,512);
        if(newerVersion(data.tag_name,this.version) && !this.available)this.checkError='A versão publicada ainda não tem um pacote de atualização válido. Tente novamente mais tarde.';
      }
    }catch{this.checkedAt=this.now();this.nextCheckAt=this.now()+60000;this.checkError='Não foi possível verificar atualizações. Você pode continuar usando o Scratches.';}
    finally {
      this.checking=false;Object.assign(this.prefs,{checkedAt:this.checkedAt,nextCheckAt:this.nextCheckAt,retryCheckAt:this.retryCheckAt});
      await writeJSON(path.join(this.home,'preferences.json'),this.prefs);
    }
    return this.view();
  }
  async dismiss(version) {
    if(this.available?.version===version){this.prefs.dismissedVersion=version;await writeJSON(path.join(this.home,'preferences.json'),this.prefs);}
    return this.view();
  }
  async start(version) {
    if(!this.enabled || !this.view().canInstall)throw new Error(this.view().installNotice || 'Não foi possível atualizar esta instalação.');
    if(this.operation || activePhases.includes(this.phase))return this.view();
    if(!this.available || version!==this.available.version)throw new Error('Esta atualização não está disponível. Verifique novamente.');
    this.phase='downloading';this.progress=0;this.error='';this.controller=new AbortController();
    this.operation=this.download(this.available,this.controller.signal).catch(async()=>{
      if(this.closed)return;
      this.phase=this.controller.signal.aborted?'idle':'error';
      this.error=this.controller.signal.aborted?'':'Não foi possível preparar a atualização. Sua instalação foi preservada. Tente novamente.';
      await fs.unlink(path.join(this.home,'pending.json')).catch(()=>{});
    }).finally(()=>{this.operation=null;});
    return this.view();
  }
  async download(candidate,signal) {
    const response=await this.request(candidate.url,{signal,timeout:300000});let size=0;const chunks=[];
    for await(const chunk of response.body){if(signal.aborted)throw signal.reason;size+=chunk.length;if(size>MAX_PACKAGE_BYTES || size>candidate.bytes)throw new Error('Pacote maior que o anunciado.');chunks.push(Buffer.from(chunk));this.progress=Math.floor(size/candidate.bytes*100);}
    if(size!==candidate.bytes)throw new Error('Pacote incompleto.');
    await prepareUpdate(this.root,Buffer.concat(chunks),candidate);
    if(signal.aborted)throw signal.reason;
    this.phase='waiting-work';this.progress=100;
    this.waitTimer=setInterval(()=>this.maybeRestart().catch(()=>{this.phase='error';this.error='Não foi possível reiniciar. Feche e abra o Scratches e tente novamente.';}),500);this.waitTimer.unref();
    await this.maybeRestart();
  }
  async maybeRestart() {
    if(this.closed || this.phase!=='waiting-work' || this.busy())return;
    // Exige ao menos uma janela presente, para não reiniciar após ela fechar.
    if(!this.clients.size)return;
    this.phase='restarting';clearInterval(this.waitTimer);
    // O navegador recebe o bloqueio antes de o servidor encerrar.
    this.restartTimer=setTimeout(()=>{if(this.busy()){this.phase='waiting-work';this.waitTimer=setInterval(()=>this.maybeRestart().catch(()=>{}),500);this.waitTimer.unref();return;}this.onRestart().catch(()=>{this.phase='error';this.error='Não foi possível reiniciar para atualizar. Tente novamente.';});},2500);
  }
  async cancel() {
    if(!['downloading','waiting-work'].includes(this.phase))return this.view();
    this.controller?.abort();clearInterval(this.waitTimer);if(this.operation)await this.operation;
    await fs.unlink(path.join(this.home,'pending.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
    this.phase='idle';this.progress=0;this.error='';return this.view();
  }
  close(){this.closed=true;clearInterval(this.timer);clearInterval(this.waitTimer);clearTimeout(this.restartTimer);this.controller?.abort();}
}
