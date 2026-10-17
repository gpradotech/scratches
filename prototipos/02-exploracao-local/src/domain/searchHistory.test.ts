import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addSearchHistory, parseSearchHistory, removeSearchHistory, searchHistoryLimit, serializeSearchHistory} from './searchHistory.ts';
import type {SearchHistoryEntry} from './searchHistory.ts';
const query: SearchHistoryEntry = {label:'Froid',url:'#/explorar?q=Froid',type:'Pesquisa'};
const song: SearchHistoryEntry = {label:'Garota · Froid',url:'#/musica/spotify%3A6fcukFVf1wSkHBZSEoOwtC',type:'Música'};

test('pesquisas e itens abertos sobrevivem à serialização, sem guardar capas ou letras', () => {
  const items = addSearchHistory(addSearchHistory([],query),song);
  assert.deepEqual(parseSearchHistory(serializeSearchHistory(items)),[song,query]);
  assert.deepEqual(Object.keys(items[0]).sort(),['label','type','url']);
});
test('refazer uma pesquisa atualiza seus filtros e a traz ao topo sem repetir o termo', () => {
  const latest = {...query,label:'FROID',url:'#/explorar?q=FROID&genre=Rap'};
  assert.deepEqual(addSearchHistory([song,query],latest),[latest,song]);
  assert.deepEqual(addSearchHistory([query,song],song),[song,query]);
});
test('remover um registro preserva os demais e limpar permanece vazio ao reabrir', () => {
  const items=[song,query];
  assert.deepEqual(parseSearchHistory(serializeSearchHistory(removeSearchHistory(items,song.url))),[query]);
  assert.deepEqual(items,[song,query]);
  assert.deepEqual(parseSearchHistory(serializeSearchHistory([])),[]);
});
test('histórico inválido ou com destinos externos não produz navegação insegura', () => {
  for (const raw of [null,'{','{}','{"version":2,"items":[]}','{"version":1,"items":{}}']) assert.deepEqual(parseSearchHistory(raw),[]);
  const bad = ['https://example.com','javascript:alert(1)','#/explorar#bad','#/projeto/123'].map(url=>({...query,url}));
  assert.deepEqual(parseSearchHistory(serializeSearchHistory([...bad,query,query,{...query,label:''}])),[query]);
  assert.deepEqual(addSearchHistory([query],bad[0]),[query]);
});
test('o histórico mantém os registros mais recentes e limita o armazenamento', () => {
  let items: SearchHistoryEntry[]=[];
  for(let index=0;index<searchHistoryLimit+5;index++) items=addSearchHistory(items,{label:'Busca '+index,url:'#/explorar?q='+index,type:'Pesquisa'});
  assert.equal(items.length,searchHistoryLimit);
  assert.equal(items[0].label,'Busca '+(searchHistoryLimit+4));
  assert.equal(items.at(-1)?.label,'Busca 5');
});
