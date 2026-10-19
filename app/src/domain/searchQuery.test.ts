import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace} from './model.ts';
import type {Catalog, Lyric, Track} from './model.ts';
import {newTrack} from './library.ts';
import {emptyFilters, searchAll} from './search.ts';
import {parseSearchQuery} from './searchQuery.ts';

const tracks: Track[] = [
  {...newTrack(), id:'a', title:'Amor de verdade', artists:[{id:'djonga',name:'Djonga'}], album:'Disco da Cidade', bpm:90},
  {...newTrack(), id:'b', title:'Amores', artists:[{id:'outro',name:'Outro Artista'},{id:'djonga',name:'Djonga'}], album:'Single da Rua'},
  {...newTrack(), id:'c', title:'Paz', artists:[{id:'outro',name:'Outro Artista'}], album:'Disco da Cidade'},
  {...newTrack(), id:'d', title:'Sem letra', artists:[{id:'outro',name:'Outro Artista'}], album:'Single novo'},
];
const catalog: Catalog = {tracks, artists:[{id:'djonga',name:'Djonga',picture:null},{id:'outro',name:'Outro Artista',picture:null}]};
function lyric(trackId: string, text: string): Lyric {return {trackId,text,revision:'1',source:'Texto fictício de teste',importedAt:'2026-10-19T00:00:00Z',languages:[],themes:[],mood:''};}
const workspace = {...emptyWorkspace(), lyrics:{
  a:lyric('a','Amor de verdade\nNa cidade encontro paz\nUma guerra distante'),
  b:lyric('b','Amores pelo caminho\nAmor e paz na rua'),
  c:lyric('c','Somente paz\nUm caminho diferente'),
}};
const found = (query: string) => searchAll(catalog,query,emptyFilters,workspace);
const ids = (query: string) => found(query).tracks.map(track => track.id).sort();

test('frases entre aspas são exatas, com limites de palavras, acentos e aspas tipográficas', () => {
  assert.deepEqual(ids('"amor"'),['a']);
  assert.deepEqual(ids('“AMOR DE VERDADE”'),['a']);
  assert.deepEqual(ids('"verdade amor"'),[]);
  assert.deepEqual(found('inlyric:"amor e paz"').passages.map(p => p.track.id),['b']);
  assert.deepEqual(found('inlyric:"amor"').passages.map(p => p.track.id),['a','b']);
  assert.equal(found('inlyric:"pelo amores"').passages.length,0);
});
test('OR é inclusivo e AND exige os dois termos com precedência e independência de verso', () => {
  assert.deepEqual(ids('intitle:amor OR intitle:paz'),['a','b','c']);
  assert.deepEqual(ids('inlyric:amor AND inlyric:distante'),['a']);
  assert.deepEqual(ids('intitle:paz OR artist:Djonga AND intitle:verdade'),['a','c']);
  assert.deepEqual(ids('artist:Djonga inlyric:distante'),['a']);
  assert.deepEqual(found('inlyric:amor AND inlyric:distante').passages.map(p => p.text),['Amor de verdade','Uma guerra distante']);
});
test('exclusões aceitam termo, frase e campo, sem gerar trechos por si só', () => {
  assert.deepEqual(ids('artist:Djonga -inlyric:guerra'),['b']);
  assert.deepEqual(ids('artist:Djonga -"amor e paz"'),['a']);
  assert.deepEqual(ids('artist:Djonga -artist:"Outro Artista"'),['a']);
  assert.deepEqual(ids('-inlyric:guerra'),['b','c','d']);
  assert.equal(found('-guerra').passages.length,0);
  assert.deepEqual(ids('inlyric:amor -inlyric:"amor e paz"'),['a']);
});
test('cada prefixo consulta somente seu campo e artista inclui participações', () => {
  assert.deepEqual(ids('intitle:cidade'),[]);
  assert.deepEqual(ids('ALBUM:"disco da cidade"'),['a','c']);
  assert.deepEqual(ids('album:single'),['b','d']);
  assert.deepEqual(ids('artist:Djonga'),['a','b']);
  assert.deepEqual(ids('inlyric:distante'),['a']);
  assert.deepEqual(ids('intitle:distante'),[]);
  assert.equal(found('album:single').passages.length,0);
  assert.equal(found('intitle:amor').artists.length,0);
});
test('apenas ramos OR satisfeitos geram evidências e filtros opcionais continuam combináveis', () => {
  const result = found('artist:inexistente AND inlyric:amor OR artist:"Outro Artista" AND inlyric:paz');
  assert.deepEqual(result.passages.map(p => p.text),['Amor e paz na rua','Somente paz']);
  const filtered = searchAll(catalog, 'artist:Djonga OR intitle:paz',{...emptyFilters,hasBpm:true},workspace);
  assert.deepEqual(filtered.tracks.map(t => t.id),['a']);
});
test('aspas protegem operadores, nomes de campo e hífens dentro da frase', () => {
  assert.equal(parseSearchQuery('inlyric:"amor OR paz"').groups[0][0].value,'amor or paz');
  assert.equal(parseSearchQuery('"artist:teste -novo"').groups[0][0].exclude,false);
  assert.equal(parseSearchQuery('hip-hop').legacy,true);
  assert.equal(parseSearchQuery('amor or paz').legacy,true);
});
test('consultas incompletas são identificadas e não ampliam a busca silenciosamente', () => {
  for (const query of ['"amor','amor OR','AND amor','amor AND OR paz','inlyric:','-','""','album:"disco"resto']) {
    assert.ok(parseSearchQuery(query).error,query);
    assert.deepEqual(found(query),{tracks:[],artists:[],passages:[]});
  }
});
test('frase atravessa três linhas e preserva offsets com emoji, acentos decompostos e refrões', () => {
  const text = '🎵 Introdução\nUm corac\u0327a\u0303o\n\ncheio de\npaz\n\nUm coração\ncheio de\npaz';
  const local = {...workspace,lyrics:{a:lyric('a',text)}};
  const result = searchAll(catalog,'inlyric:"coração cheio de paz"',emptyFilters,local);
  assert.equal(result.passages.length,1); // Equivalent NFC refrain is deduplicated; keep the first original text.
  for (const p of result.passages) {
    assert.equal(text.slice(p.start,p.end),p.text);
    assert.equal(p.endLine - p.startLine,2);
    assert.ok(p.text.startsWith('Um '));
  }
  assert.equal(local.lyrics.a.text,text);
});
test('pontuação é literal e não é executada como expressão regular', () => {
  const local = {...catalog, tracks:[{...tracks[0],title:'Teste (A+B) [ao vivo]'}]};
  assert.equal(searchAll(local,'intitle:"(A+B) [ao vivo]"',emptyFilters,workspace).tracks.length,1);
  assert.equal(searchAll(local,'intitle:".*"',emptyFilters,workspace).tracks.length,0);
});
test('busca comum permanece compatível, sem transformar trecho em correspondência de título', () => {
  assert.equal(parseSearchQuery('amor de verdade').legacy,true);
  assert.deepEqual(ids('amor de verdade'),['a']);
  assert.deepEqual(ids('distante'),[]);
  assert.equal(found('distante').passages.length,1);
  assert.deepEqual(ids(''),['a','b','c','d']);
});
