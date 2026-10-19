import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {resolveArtist, deezerTrack, mergePopulation} from '../lib/catalog-population.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = process.argv.slice(2);
const argument = (key, fallback) => options.find(option => option.startsWith(key + '='))?.slice(key.length + 1) ?? fallback;
const perArtist = Number(argument('--por-artista', 0));
if (!Number.isInteger(perArtist) || perArtist < 0 || perArtist > 100) throw new Error('--por-artista deve ficar entre 1 e 100, ou ser omitido.');
const config = JSON.parse(await fs.readFile(path.join(root, 'config/catalogo-inicial.json'), 'utf8'));
if (!options.includes('--aplicar')) {
  console.log(JSON.stringify({artists: config.artists.length,requestedTracks:config.artists.reduce((n, a) => n + (perArtist || a.tracks),0),groups:config.artists.reduce((out,a)=>({...out,[a.group]:(out[a.group]||0)+1}),{}),apply:'npm run catalogo:popular -- --aplicar'},null,2));
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const run = path.join(root, '.scratches', 'catalogo-' + stamp);
const cache = path.join(root, '.scratches', 'catalogo-fontes', 'deezer');
const target = path.join(root, 'app/public/catalogo/catalogo.json');
await fs.mkdir(run, {recursive: true}); await fs.mkdir(cache, {recursive: true});
const baseline = await fs.readFile(target, 'utf8').catch(error => {if (error.code !== 'ENOENT') throw error; return JSON.stringify({tracks:[],artists:[]});});
await fs.writeFile(path.join(run, 'catalogo-anterior.json'), baseline);
await fs.copyFile(path.join(root,'dados/prototipo-02/workspace.json'),path.join(run,'workspace-anterior.json')).catch(error=>{if(error.code!=='ENOENT')throw error;});
let nextRequest = 0, calls = 0, cached = 0;
const failures = [], resolved = [], candidates = new Map(), albumCache = new Map(), profiles = new Map(), tracks = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function query(endpoint) {
  if (!/^\/(search\/artist\?|artist\/\d+\/top\?|track\/\d+$|album\/\d+$)/.test(endpoint)) throw new Error('Consulta não autorizada.');
  const file = path.join(cache, createHash('sha256').update(endpoint).digest('hex') + '.json');
  try {const entry = JSON.parse(await fs.readFile(file,'utf8')); if (Date.now() - entry.at < 86400000) {cached++; return entry.body;}} catch(error) {if(error.code && error.code!=='ENOENT')throw error;}
  for (let attempt = 0; attempt < 3; attempt++) {
    const scheduled = Math.max(Date.now(), nextRequest); nextRequest = scheduled + 500;
    if (scheduled > Date.now()) await sleep(scheduled - Date.now());
    try {
      calls++;
      const response = await fetch('https://api.deezer.com' + endpoint, {headers:{Accept:'application/json','User-Agent':'Scratches/0.2.0 (https://github.com/gpradotech/scratches)'},signal:AbortSignal.timeout(12000),redirect:'error'});
      const body = await response.json();
      if (response.status === 429 || body.error?.code === 4 || response.status >= 500) {await sleep(Math.max(2000 * (attempt+1), Number(response.headers.get('retry-after'))*1000 || 0)); continue;}
      if (!response.ok || body.error) throw new Error(body.error?.message || 'HTTP ' + response.status);
      // Apenas metadados; o catálogo gerado não incorpora preview, áudio, token ou letras.
      await fs.writeFile(file,JSON.stringify({at:Date.now(),endpoint,body})); return body;
    } catch(error) {if(attempt===2)throw error; await sleep(1000*(attempt+1));}
  }
  throw new Error('A fonte limitou as consultas.');
}
async function pool(items, task, label) {
  let index = 0, done = 0;
  await Promise.all(Array.from({length:3}, async()=>{while(index<items.length){const item=items[index++];try{await task(item);}catch(error){failures.push({stage:label,item:item.name||item.id||item,error:error.message});}done++;if(done%25===0||done===items.length)console.log(`${label}: ${done}/${items.length}; ${calls} consultas, ${cached} em cache.`);}}));
}
await pool(config.artists, async seed => {
  const matches = await query('/search/artist?' + new URLSearchParams({q:seed.name,limit:'10'}));
  const artist = resolveArtist(matches.data || [],seed.name); if(!artist)throw new Error('Nenhum artista com nome correspondente.');
  resolved.push({...seed,id:artist.id,matchedName:artist.name});
  profiles.set(`deezer-artist:${artist.id}`,{id:`deezer-artist:${artist.id}`,name:artist.name,picture:artist.picture_medium||null});
  const body = await query(`/artist/${artist.id}/top?` + new URLSearchParams({limit:String(perArtist||seed.tracks)}));
  for(const row of body.data || []) {
    if(row.readable===false)continue;
    if(![row.artist,...row.contributors||[]].some(a=>String(a?.id)===String(artist.id)))continue;
    const item=candidates.get(row.id) || {id:row.id,groups:[],seeds:[]};
    if(!item.groups.includes(seed.group))item.groups.push(seed.group); if(!item.seeds.includes(seed.name))item.seeds.push(seed.name); candidates.set(row.id,item);
  }
}, 'Artistas');
if(!candidates.size)throw new Error('Não houve músicas confirmadas. O catálogo original foi preservado.');
console.log(`Seleção: ${candidates.size} gravações distintas de ${resolved.length} artistas de partida.`);
async function album(id) {
  if(!id)return null;
  if(!albumCache.has(id))albumCache.set(id,query('/album/'+id).catch(error=>{failures.push({stage:'Álbum',item:id,error:error.message});return null;}));
  return albumCache.get(id);
}
await pool([...candidates.values()], async candidate => {
  const row=await query('/track/'+candidate.id);
  if(String(row.id)!==String(candidate.id))throw new Error('A fonte retornou outro identificador.');
  const release=await album(row.album?.id);
  const track=deezerTrack(row,release);if(!track)return;
  for(const a of row.contributors?.length?row.contributors:[row.artist])if(a?.id&&a.name){const id=`deezer-artist:${a.id}`;profiles.set(id,{id,name:a.name,picture:a.picture_medium||profiles.get(id)?.picture||null});}
  tracks.push({track,candidate});
}, 'Músicas e álbuns');
const priority = item => item.candidate.groups.includes('rap-br') ? 0 : item.candidate.groups.includes('br') ? 1 : 2;
tracks.sort((a,b)=>priority(a)-priority(b)||a.track.artists[0].name.localeCompare(b.track.artists[0].name,'pt-BR')||a.track.title.localeCompare(b.track.title,'pt-BR'));
const workspace=await fs.readFile(path.join(root,'dados/prototipo-02/workspace.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;return {};});
const result=mergePopulation(JSON.parse(baseline),tracks.map(item=>item.track),[...profiles.values()],workspace);
if(!tracks.length)throw new Error('Nenhuma gravação pôde ser confirmada. O catálogo original foi preservado.');
if(!result.added)console.log('O catálogo já contém as gravações confirmadas nesta seleção.');
const report={at:new Date().toISOString(),provider:'Deezer',selection:config.description,requestedArtists:config.artists.length,resolvedArtists:resolved.length,candidates:candidates.size,added:result.added,totalTracks:result.catalog.tracks.length,totalArtists:result.catalog.artists.length,duplicates:result.duplicates,calls,cached,groups:{},coverage:{},failures,resolved,
  recordings:tracks.filter(item=>result.catalog.tracks.some(track=>track.id===item.track.id)).map(item=>({id:item.track.id,groups:item.candidate.groups,seeds:item.candidate.seeds,source:item.track.source}))};
for(const row of report.recordings){const group=row.groups.includes('rap-br')?'rap-br':row.groups.includes('br')?'br':'internacional';report.groups[group]=(report.groups[group]||0)+1;}
for(const field of ['cover','bpm','key','mode','releaseDate','isrc','label','releaseType','explicit'])report.coverage[field]=result.catalog.tracks.filter(track=>track[field]!==null&&track[field]!==undefined).length;
report.coverage.genres=result.catalog.tracks.filter(track=>track.genres.length).length;
report.coverage.languages=result.catalog.tracks.filter(track=>track.languages?.length).length;
report.coverage.localCovers=result.catalog.tracks.filter(track=>track.cover?.startsWith('data:image/')||track.cover?.startsWith('/catalogo/')).length;
report.coverage.artistPictures=result.catalog.artists.filter(artist=>artist.picture).length;
report.coverage.localArtistPictures=result.catalog.artists.filter(artist=>artist.picture?.startsWith('data:image/')||artist.picture?.startsWith('/catalogo/')).length;
await fs.writeFile(path.join(run,'relatorio.json'),JSON.stringify(report,null,2));
await fs.writeFile(path.join(run,'catalogo-candidato.json'),JSON.stringify(result.catalog));
const current=await fs.readFile(target,'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return JSON.stringify({tracks:[],artists:[]});});
if(current!==baseline)throw new Error('O catálogo foi alterado durante a coleta. O candidato foi guardado, sem sobrescrever os dados atuais.');
await fs.mkdir(path.dirname(target),{recursive:true}); const temporary=target+'.pending';
await fs.writeFile(temporary,JSON.stringify(result.catalog)); await fs.rename(temporary,target);
console.log(JSON.stringify({added:result.added,total:report.totalTracks,artists:report.totalArtists,groups:report.groups,coverage:report.coverage,failures:failures.length,report:path.join(run,'relatorio.json')},null,2));
