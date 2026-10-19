import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ArtworkCache} from '../lib/artwork-cache.mjs';
import {artworkSources} from '../lib/artwork-source.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await fs.readFile(path.join(root, 'app/public/catalogo/catalogo.json'), 'utf8'));
let workspace = {};
try {workspace = JSON.parse(await fs.readFile(path.join(root, 'dados/prototipo-02/workspace.json'), 'utf8'));}
catch (error) {if (error.code !== 'ENOENT') throw error;}
const sources = artworkSources(catalog, workspace);
const cache = new ArtworkCache(root);
let saved = 0, failures = 0, consecutive = 0;
for (const source of sources) {
  if (await cache.get(source)) {saved++; consecutive = 0;} else {failures++; consecutive++;}
  if ((saved + failures) % 50 === 0) console.log(`${saved} imagens disponíveis localmente; ${failures} falhas.`);
  if (consecutive >= 4) {console.log('A fonte recusou quatro imagens consecutivas. A recuperação foi interrompida para evitar novas consultas sem resultado.'); break;}
  await new Promise(resolve => setTimeout(resolve, 100));
}
console.log(`${saved}/${sources.length} imagens verificadas e preservadas no cache local. ${failures} falhas; ${sources.length - saved - failures} ainda não consultadas.`);
if (failures) process.exitCode = 1;
