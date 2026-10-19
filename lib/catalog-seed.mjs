import fs from 'node:fs/promises';
import path from 'node:path';
export async function readCatalog(root, appPath='app') {
  const read=async file=>fs.readFile(file,'utf8').then(JSON.parse).catch(error=>{if(error.code!=='ENOENT')throw error;return null;});
  const seed=await read(path.join(root,'lib/seed/catalog.json')) ?? {tracks:[],artists:[]};
  const local=await read(path.join(root,appPath,'public/catalogo/catalogo.json')) ?? await read(path.join(root,appPath,'dist/catalogo/catalogo.json')) ?? {tracks:[],artists:[]};
  return {tracks:[...new Map([...(seed.tracks ?? []),...(local.tracks ?? [])].map(track=>[track.id,track])).values()],artists:[...new Map([...(seed.artists ?? []),...(local.artists ?? [])].map(artist=>[artist.id,artist])).values()]};
}
