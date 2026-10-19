import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPackage,decodePackage} from '../lib/update-package.mjs';
import {sha256} from '../lib/update-package.mjs';
import {releaseZip} from './release-zip.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=await buildPackage(root,{legacyCompatible:true});
const directory=path.join(root,'dist');await fs.mkdir(directory,{recursive:true});
const name=`scratches-${result.version}.update.json.gz`;
await fs.writeFile(path.join(directory,name),result.compressed);
await fs.writeFile(path.join(directory,name+'.sha256'),`${result.digest}  ${name}\n`);
const files=decodePackage(result.compressed,result).files;
const manifest=files.map(({path,sha256})=>({path,sha256}));
await fs.writeFile(path.join(directory,`scratches-${result.version}.update.manifest.json`),JSON.stringify({version:result.version,digest:result.digest,files:manifest},null,2)+'\n');
// New downloads use the current launcher name; installed v0.1.0 keeps its
// original launcher, which is updated through its existing allowlist.
const zipFiles=files.map(file=>file.path==='iniciar-prototipo.cmd'?{...file,path:'iniciar-app.cmd'}:file);
const zipName=`scratches-${result.version}.zip`, zip=releaseZip(zipFiles,result.version);
await fs.writeFile(path.join(directory,zipName),zip);
await fs.writeFile(path.join(directory,zipName+'.sha256'),`${sha256(zip)}  ${zipName}\n`);
console.log(JSON.stringify({version:result.version,files:result.files,bytes:result.compressed.length,digest:result.digest,file:path.join(directory,name),download:path.join(directory,zipName),downloadDigest:sha256(zip)},null,2));
