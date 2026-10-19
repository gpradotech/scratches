import fs from 'node:fs/promises';
import {readCatalog} from './catalog-seed.mjs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const key = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const title = value => key(String(value).replace(/\s*\(?\b(?:feat\.?|featuring|ft\.?)\s+.*$/i, ''));
const edition = value => [...new Set(key(value).match(/\b(?:live|ao vivo|acoustic|acustico|remix|instrumental)\b/g) || [])].sort().join('|');
export function lyricMatch(track, record) {
  const artist = key(track.artists[0]?.name);
  const credits = String(record.artistName || '').split(/[,;]|\bfeaturing\b|\bfeat\.?\s|\bft\.?\s/i);
  const artistMatches = credits.some(credit => key(credit) === artist || credit.split(/\s+(?:&|and|e|with)\s+/i).some(name => key(name) === artist));
  return Number.isSafeInteger(record.id) && record.id > 0 && title(track.title) === title(record.trackName) && edition(track.title) === edition(record.trackName) && !!artist && artistMatches &&
    Number.isFinite(record.duration) && Math.abs(track.duration - record.duration) <= 2;
}
export function lyricRecord(track, record) {
  if (!lyricMatch(track, record)) return null;
  if (record.instrumental) return {instrumental: true};
  const text = typeof record.plainLyrics === 'string' && record.plainLyrics.trim() ? record.plainLyrics : typeof record.syncedLyrics === 'string' ? record.syncedLyrics.replace(/\[[^\]\n]+\]/g, '').trim() : '';
  if (!text.trim() || text.length > 100000) return null;
  return {trackId: track.id, text, revision: 'lrclib:' + record.id + ':' + createHash('sha256').update(text).digest('hex').slice(0,16), source: 'https://lrclib.net/api/get/' + record.id,
    importedAt: new Date().toISOString(), languages: [], themes: [], mood: ''};
}
export class LyricsSync {
  constructor(root, store, {fetchImpl = fetch, wait = pause, delay = 500} = {}) {
    this.root = root; this.store = store; this.fetch = fetchImpl; this.wait = wait; this.delay = delay;
    this.state = {running: false, total: 0, processed: 0, indexed: 0, existing: 0, missing: 0, instrumental: 0, errors: 0}; this.stopped = false;
  }
  async query(endpoint) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (this.stopped) throw new Error('Busca interrompida.');
      await this.wait(this.delay);
      if (this.stopped) throw new Error('Busca interrompida.');
      let response;
      try {response = await this.fetch('https://lrclib.net/api/' + endpoint, {headers: {'User-Agent': 'Scratches/0.2.0 (https://github.com/gpradotech/scratches)'}, signal: AbortSignal.timeout(15000), redirect: 'error'});}
      catch(error) {if(attempt===2)throw error;await this.wait(1000*(attempt+1));continue;}
      if (response.status === 404) return null;
      if (response.status === 429 || response.status >= 500) {
        const retry = response.headers.get('retry-after');
        const ms = /^\d+$/.test(retry || '') ? Number(retry)*1000 : Date.parse(retry || '') - Date.now();
        await this.wait(Math.max(1000*(attempt+1), Number.isFinite(ms) ? ms : 0)); continue;
      }
      if (!response.ok) throw new Error('A fonte respondeu HTTP ' + response.status);
      const text = await response.text(); if (text.length > 2000000) throw new Error('Resposta da fonte excedeu o limite.');
      return JSON.parse(text);
    }
    throw new Error('Fonte temporariamente indisponível após três tentativas.');
  }
  async lookup(track) {
    const matches = await this.query('search?' + new URLSearchParams({track_name: track.title.replace(/\s*\(?\b(?:feat\.?|featuring|ft\.?)\s+.*$/i, ''), artist_name: track.artists[0].name}));
    const candidates = (Array.isArray(matches) ? matches : []).filter(record => lyricMatch(track, record));
    candidates.sort((a,b) => Number(key(b.albumName)===key(track.album))-Number(key(a.albumName)===key(track.album)) || Math.abs(a.duration-track.duration)-Math.abs(b.duration-track.duration));
    const best = candidates[0];
    if (!best) {
      if (!Array.isArray(matches) || !matches.length) return null;
      const params = new URLSearchParams({track_name: track.title, artist_name: track.artists[0].name, album_name: track.album, duration: String(track.duration)});
      const exact = track.duration > 0 && track.duration <= 3600 ? await this.query('get?' + params) : null;
      return exact ? lyricRecord(track, exact) : null;
    }
    const tied = candidates.filter(record => key(record.albumName) === key(best.albumName) && Math.abs(record.duration-track.duration) === Math.abs(best.duration-track.duration));
    if (new Set(tied.map(record => record.plainLyrics || record.syncedLyrics || String(record.instrumental))).size > 1) return null;
    return lyricRecord(track, best);
  }
  start() {if (!this.job) {this.stopped = false; this.state.running = true; this.job = this.run().catch(error => {this.state.error = error.message;}).finally(()=>{this.state.running=false;this.job=null;});} return this.state;}
  stop() {this.stopped = true;}
  async retain(lyric) {
    let added = false;
    await this.store.update(latest => {
      if (latest.lyrics[lyric.trackId]?.text.trim()) return latest;
      const next = {...latest,lyrics:{...latest.lyrics,[lyric.trackId]:lyric}};
      if (Buffer.byteLength(JSON.stringify(next)) > 7800000) throw new Error('O espaço de letras atingiu o limite desta versão.');
      added = true; return next;
    });
    return added;
  }
  async run() {
    const folder = path.join(this.root, '.scratches'); await fs.mkdir(folder,{recursive:true});
    const file = path.join(folder,'lyrics-index.json');
    let records = {}; try {records = JSON.parse(await fs.readFile(file,'utf8'));} catch(e) {if(e.code!=='ENOENT')throw e;}
    const workspace = await this.store.read();
    await fs.writeFile(path.join(folder,'antes-letras-' + new Date().toISOString().replace(/[:.]/g,'-') + '.json'), JSON.stringify(workspace));
    const base = await readCatalog(this.root);
    const tracks = [...new Map([...base.tracks,...Object.values(workspace.tracks || {})].map(track=>[track.id,track])).values()];
    const existing = new Set(Object.entries(workspace.lyrics).filter(([,lyric])=>lyric.text.trim()).map(([id])=>id));
    this.state = {running:true,total:tracks.length,processed:0,indexed:0,existing:0,missing:0,instrumental:0,errors:0};
    for (const track of tracks) {
      if (this.stopped) break;
      this.state.current = track.title;
      const signature = createHash('sha256').update(JSON.stringify(['search-v2',track.title,track.artists,track.album,track.duration])).digest('hex');
      const cached = records[track.id];
      if (existing.has(track.id)) this.state.existing++;
      else if (cached?.signature === signature && ['missing','instrumental','errors'].includes(cached.status) && Date.now()-cached.at < (cached.status==='errors'?3600000:7*86400000)) this.state[cached.status]++;
      else {
        try {
          const lyric = await this.lookup(track);
          if (this.stopped) break;
          let status = lyric?.instrumental ? 'instrumental' : lyric ? 'indexed' : 'missing';
          if (status === 'indexed' && !await this.retain(lyric)) status = 'existing';
          this.state[status]++; records[track.id]={signature,at:Date.now(),status,source:lyric?.source || null};
        } catch(error) {if(this.stopped)break;this.state.errors++;records[track.id]={signature,at:Date.now(),status:'errors',error:error.message};}
      }
      this.state.processed++;
      if (this.state.processed%10===0 || this.state.processed===tracks.length) {await fs.writeFile(file,JSON.stringify(records,null,2));console.log(`Letras: ${this.state.processed}/${tracks.length}; ${this.state.indexed} obtidas; ${this.state.missing} sem correspondência; ${this.state.errors} falhas.`);}
    }
    if (!this.stopped) {
      const retry = tracks.filter(track => !existing.has(track.id) && records[track.id]?.status === 'errors' && (!records[track.id].retriedAt || Date.now()-records[track.id].retriedAt >= 3600000));
      this.state.retrying = true; this.state.retryTotal = retry.length; this.state.retryProcessed = 0;
      for (const track of retry) {
        if (this.stopped) break;
        this.state.current = track.title;
        try {
          const lyric = await this.lookup(track); if (this.stopped) break;
          let status = lyric?.instrumental ? 'instrumental' : lyric ? 'indexed' : 'missing';
          if (status === 'indexed' && !await this.retain(lyric)) status = 'existing';
          this.state.errors--; this.state[status]++;
          records[track.id] = {...records[track.id],at:Date.now(),status,source:lyric?.source || null,error:undefined};
        } catch(error) {if(this.stopped)break;records[track.id]={...records[track.id],at:Date.now(),retriedAt:Date.now(),error:error.message};}
        this.state.retryProcessed++;
        if (this.state.retryProcessed%10===0) await fs.writeFile(file,JSON.stringify(records,null,2));
      }
      this.state.retrying = false;
    }
    if (!this.stopped) await fs.writeFile(file,JSON.stringify(records,null,2)); delete this.state.current;
  }
}
export function lyricsApi(sync) {
  return async (req,res,next) => {
    if (req.url?.split('?')[0] !== '/api/lyrics/sync') {next();return;}
    const host=req.headers.host || '',origin=req.headers.origin;
    const allowed=/^(127\.0\.0\.1|localhost):\d+$/.test(host) && ['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && (!origin || origin==='http://'+host) && req.headers['sec-fetch-site']!=='cross-site';
    const status=!allowed?403:!['GET','POST'].includes(req.method)?405:200;
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify(status===200 ? req.method==='POST'?sync.start():sync.state : {error:'Acesso permitido apenas pelo aplicativo local.'}));
  };
}
