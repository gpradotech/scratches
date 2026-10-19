import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {ArtworkCache} from '../lib/artwork-cache.mjs';
import {artworkSources,providerArtwork} from '../lib/artwork-source.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
let catalog=await fs.readFile(path.join(root,'app/public/catalogo/catalogo.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
if(!catalog?.tracks?.length)catalog=JSON.parse(await fs.readFile(path.join(root,'lib/seed/catalog.json'),'utf8'));
if(catalog.tracks.some(track=>track.sourceMatch!=='provider_catalog'))throw Error('O catálogo inicial deve conter somente registros importados das fontes públicas.');
if(process.argv.includes('--plan')){console.log(JSON.stringify({tracks:catalog.tracks.length,artists:catalog.artists.length}));process.exit(0);}
for(const track of catalog.tracks)if(providerArtwork(track.cover))track.cover=track.cover.replace('/500x500-','/250x250-');
for(const artist of catalog.artists)if(!providerArtwork(artist.picture))artist.picture=null;
const folder=path.join(root,'lib/seed');await fs.mkdir(path.join(folder,'artwork'),{recursive:true});
await fs.writeFile(path.join(folder,'catalog.json'),JSON.stringify(catalog));
const sources=artworkSources(catalog),cache=new ArtworkCache(root);let cursor=0,saved=0;const missing=[];
await Promise.all(Array.from({length:4},async()=>{while(cursor<sources.length){const source=sources[cursor++],result=await cache.get(source);if(result){const key=createHash('sha256').update(source).digest('hex');await fs.writeFile(path.join(folder,'artwork',key),result.bytes);saved++;}else missing.push(source);if((saved+missing.length)%100===0)console.log(`${saved}/${sources.length} imagens prontas para distribuição.`);await new Promise(resolve=>setTimeout(resolve,100));}}));
const report={tracks:catalog.tracks.length,artists:catalog.artists.length,images:saved,missing};await fs.writeFile(path.join(root,'.scratches/seed-artwork-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
