import test from 'node:test';
import assert from 'node:assert/strict';
import {deezerTrack, mergePopulation, resolveArtist} from '../lib/catalog-population.mjs';

const row = {id:42,title:'Faixa',artist:{id:1,name:'Artista'},contributors:[{id:1,name:'Artista'},{id:2,name:'Participação'}],album:{id:8,title:'Disco',cover_medium:'https://example.org/capa.jpg'},duration:167,readable:true,available_countries:['BR'],bpm:0,isrc:'BRABC2600001',release_date:'2026-10-18',explicit_lyrics:false,preview:'https://example.org/audio.mp3',track_token:'not-for-catalog'};
const album = {id:8,title:'Disco',genres:{data:[{name:'Rap/Hip Hop'}]},record_type:'album',label:'Selo'};

test('resolve artista por nome correspondente, tolera acentos e pontuação e recusa candidatos diferentes', () => {
  const artists=[{id:2,name:'Outro',nb_fan:999},{id:1,name:'Racionais MC’s',nb_fan:20},{id:3,name:"Racionais MC's",nb_fan:2}];
  assert.equal(resolveArtist(artists,"Racionais MC's").id,1);
  assert.equal(resolveArtist([{id:1,name:'Tássia Reis'}],'Tassia Reis').id,1);
  assert.equal(resolveArtist(artists,'RZO'),null);
});

test('importa dados confirmados e participações, sem inferir idioma, tom ou BPM nem incorporar áudio', () => {
  const track=deezerTrack(row,album);
  assert.equal(track.artists.length,2);assert.equal(track.duration,167);assert.equal(track.isrc,row.isrc);
  assert.deepEqual(track.genres,['Rap/Hip Hop']);assert.equal(track.releaseType,'album');assert.equal(track.label,'Selo');
  assert.equal(track.bpm,null);assert.equal(track.key,null);assert.deepEqual(track.languages,[]);
  for(const field of ['preview','track_token','lyrics'])assert.equal(field in track,false);
  assert.equal(deezerTrack({...row,bpm:89.6},album).bpm,89.6);
  assert.equal(deezerTrack({...row,readable:false},album),null);
  assert.equal(deezerTrack({...row,available_countries:['US']},album),null);
  assert.throws(()=>deezerTrack(row,{...album,id:9}),/não corresponde/);
  assert.equal(deezerTrack({...row,release_date:'2026-02-31'},null).releaseDate,null);
});

test('população preserva cadastro existente e retrato local, deduplica gravações e mantém versões distintas', () => {
  const first=deezerTrack(row,album);
  const existing={...first,title:'Título conferido localmente'};
  const base={tracks:[existing],artists:[{id:'deezer-artist:1',name:'Artista',picture:'/catalogo/retrato.jpg'}]};
  const incoming=[first,{...first,id:'deezer:43'},{...first,id:'deezer:44',isrc:'BRABC2600002'}];
  const result=mergePopulation(base,incoming,[{id:'deezer-artist:1',name:'Artista',picture:'https://example.org/photo.jpg'}]);
  assert.equal(result.added,1);assert.equal(result.duplicates,2);assert.equal(result.catalog.tracks.length,2);
  assert.equal(result.catalog.tracks[0].title,existing.title);assert.equal(result.catalog.artists[0].picture,base.artists[0].picture);
  assert.equal(mergePopulation(result.catalog,incoming,[]).added,0);
  assert.equal(base.tracks.length,1);
});

test('carga não duplica gravação manual e reaproveita imagens locais por identidade', () => {
  const track=deezerTrack(row,album);
  const image='data:image/png;base64,'+Buffer.from('\x89PNG\r\n\x1a\n'+'\0'.repeat(24),'binary').toString('base64');
  const workspace={tracks:{local:{...track,id:'local:manual'}},metadata:{albums:[{id:track.albumId,cover:image}],artists:[{id:track.artists[0].id,name:'Artista',picture:image}]}};
  assert.equal(mergePopulation({tracks:[],artists:[]},[track],[],workspace).added,0);
  const another={...track,id:'deezer:43',isrc:'BRABC2600002'};
  const result=mergePopulation({tracks:[],artists:[]},[another],[],workspace);
  assert.equal(result.catalog.tracks[0].cover,image);assert.equal(result.catalog.artists[0].picture,image);
  assert.equal(mergePopulation({tracks:[another],artists:[]},[],[],workspace).catalog.tracks[0].cover,image);
  assert.equal(workspace.tracks.local.id,'local:manual');
});
