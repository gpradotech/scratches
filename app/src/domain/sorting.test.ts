import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Track} from './model.ts';
import {nextTrackSort, sortAnnouncement, sortFromParams, sortTracks, sortingParams, trackListNumber} from './sorting.ts';
import type {TrackSort} from './sorting.ts';
import {pagination} from './pagination.ts';
const track: Track = {id: '1', title: 'Faixa 10', artists: [{id: 'a', name: 'Ágata'}], album: 'Álbum B', duration: 90, cover: null, catalogAlbum: null, bpm: null, key: null, mode: null, genres: [], genreScope: 'album', releaseDate: null, source: null, sourceMatch: '', lyricsReferences: [], isrc: null};
const tracks: Track[] = [track, {...track, id: '2', title: 'Faixa 2', artists: [{id: 'b', name: 'Bruno'}], album: 'Álbum A', duration: 120}, {...track, id: '3', title: 'Outra', artists: [{id: 'c', name: 'Caio'}], album: 'Álbum C', duration: 60}];
test('Título alterna A–Z, Z–A, artista A–Z, artista Z–A e restaura a ordem padrão', () => {
  let sort: TrackSort = null;
  const observed: TrackSort[] = [];
  for (let click = 0; click < 5; click++) {sort = nextTrackSort(sort, 'title'); observed.push(sort);}
  assert.deepEqual(observed, [{key:'title',direction:'asc'}, {key:'title',direction:'desc'}, {key:'artist',direction:'asc'}, {key:'artist',direction:'desc'}, null]);
  assert.deepEqual(nextTrackSort({key:'artist',direction:'desc'}, 'album'), {key:'album',direction:'asc'});
});
test('número alterna apenas entre ligado na ordem inversa e desligado na ordem original', () => {
  let sort: TrackSort = null;
  for (const enabled of [true, false, true, false]) {
    sort = nextTrackSort(sort, 'sequence');
    assert.deepEqual(sort, enabled ? {key:'sequence',direction:'desc'} : null);
    assert.deepEqual(sortTracks(tracks, sort).map(t => t.id), enabled ? ['3','2','1'] : ['1','2','3']);
  }
  assert.deepEqual(nextTrackSort({key:'title',direction:'desc'}, 'sequence'), {key:'sequence',direction:'desc'});
  assert.equal(sortFromParams(new URLSearchParams('ordenar=sequence-asc')), null);
  assert.equal(sortingParams(new URLSearchParams('ordenar=sequence-desc'), null).get('ordenar'), null);
});

test('álbum, BPM e duração alternam crescente, decrescente e ordem padrão', () => {
  for (const column of ['album','bpm','duration'] as const) {
    const ascending = nextTrackSort(null, column)!;
    const descending = nextTrackSort(ascending, column)!;
    assert.deepEqual(ascending, {key:column,direction:'asc'});
    assert.deepEqual(descending, {key:column,direction:'desc'});
    assert.equal(nextTrackSort(descending, column), null);
  }
});
test('ordena texto em português, nomes com números, artistas, álbuns e duração sem mudar a origem', () => {
  const ids = (sort: TrackSort) => sortTracks(tracks, sort).map(t => t.id);
  assert.deepEqual(ids({key:'title',direction:'asc'}), ['2','1','3']);
  assert.deepEqual(ids({key:'title',direction:'desc'}), ['3','1','2']);
  assert.deepEqual(ids({key:'artist',direction:'desc'}), ['3','2','1']);
  assert.deepEqual(ids({key:'album',direction:'asc'}), ['2','1','3']);
  assert.deepEqual(ids({key:'duration',direction:'asc'}), ['3','1','2']);
  assert.deepEqual(ids({key:'sequence',direction:'desc'}), ['3','2','1']);
  assert.deepEqual(ids(null), ['1','2','3']);
  assert.deepEqual(tracks.map(t=>t.id), ['1','2','3']);
});
test('valores não informados ficam no final e empates mantêm a ordem original', () => {
  const source = [{...track, id:'missing', duration:NaN, album:''}, track, {...track,id:'same'}];
  for (const key of ['duration','album'] as const) for (const direction of ['asc','desc'] as const) assert.deepEqual(sortTracks(source, {key,direction}).map(t=>t.id), ['1','same','missing']);
});

test('BPM ordena numericamente com decimais e empates estáveis, mantendo ausências no final', () => {
  const source = [{...track,id:'missing',bpm:null}, {...track,id:'fast',bpm:120}, {...track,id:'slow',bpm:80.5}, {...track,id:'same',bpm:80.5}, {...track,id:'invalid',bpm:NaN}];
  assert.deepEqual(sortTracks(source, {key:'bpm',direction:'asc'}).map(t=>t.id), ['slow','same','fast','missing','invalid']);
  assert.deepEqual(sortTracks(source, {key:'bpm',direction:'desc'}).map(t=>t.id), ['fast','slow','same','missing','invalid']);
  const params = sortingParams(new URLSearchParams('q=amor&pagina=3&porPagina=25'), {key:'bpm',direction:'desc'});
  assert.deepEqual(sortFromParams(new URLSearchParams(params.toString())), {key:'bpm',direction:'desc'});
  assert.equal(params.get('pagina'), null); assert.equal(params.get('q'), 'amor'); assert.equal(params.get('porPagina'), '25');
  assert.equal(sortAnnouncement({key:'bpm',direction:'asc'}), 'Lista ordenada por bpm, do menor para o maior.');
  assert.equal(sortAnnouncement({key:'bpm',direction:'desc'}), 'Lista ordenada por bpm, do maior para o menor.');
  assert.deepEqual(source.map(t=>t.id), ['missing','fast','slow','same','invalid']);
});
test('ordenar preserva consulta, filtros múltiplos e capacidade, reinicia a página e resiste ao reload', () => {
  const base = new URLSearchParams('q=amor&genre=Rap&genre=Rock&album=Crise&pagina=3&porPagina=25');
  const params = sortingParams(base, {key:'artist',direction:'desc'});
  assert.equal(params.get('pagina'), null); assert.equal(params.get('porPagina'), '25');
  assert.equal(params.get('q'), 'amor'); assert.equal(params.get('album'), 'Crise'); assert.deepEqual(params.getAll('genre'), ['Rap','Rock']);
  assert.deepEqual(sortFromParams(new URLSearchParams(params.toString())), {key:'artist',direction:'desc'});
  assert.equal(sortingParams(params, null).get('ordenar'), null);
  for (const value of ['', 'unknown-asc', 'title-up', 'title-asc-', 'album-desc-extra']) assert.equal(sortFromParams(new URLSearchParams({ordenar:value})), null);
  assert.equal(base.get('pagina'), '3');
});
test('ordenação global precede a paginação e não perde nem duplica músicas', () => {
  const source = Array.from({length:35}, (_,i)=>({...track,id:String(i),duration:35-i}));
  const ordered = sortTracks(source, {key:'duration',direction:'asc'});
  const result: string[] = [];
  for (let page=1; page<=4; page++) {const paging=pagination(ordered.length,new URLSearchParams({pagina:String(page)}));result.push(...ordered.slice(paging.start,paging.end).map(t=>t.id));}
  assert.equal(result[0], '34'); assert.equal(result[34], '0');
  assert.equal(result.length, 35); assert.equal(new Set(result).size, 35);
});

test('numeração acompanha a posição visual e só fica decrescente quando # está ativo, inclusive entre páginas', () => {
  const source = Array.from({length:35}, (_,i)=>({...track,id:String(i),title:`Faixa ${35-i}`,album:`Álbum ${i%4}`,duration:35-i,bpm:60+i%5}));
  const sorts: TrackSort[] = [null, {key:'sequence',direction:'desc'}, ...(['title','artist','album','bpm','duration'] as const).flatMap(key => (['asc','desc'] as const).map(direction=>({key,direction})))];
  for (const sort of sorts) {
    const ordered = sortTracks(source, sort);
    const numbers: number[] = [];
    for (let page=1; page<=4; page++) {
      const paging = pagination(ordered.length, new URLSearchParams({pagina:String(page)}));
      numbers.push(...ordered.slice(paging.start,paging.end).map((_,index)=>trackListNumber(paging.start+index,paging.total,sort)));
    }
    assert.deepEqual(numbers, Array.from({length:35},(_,index)=>sort?.key === 'sequence' ? 35-index : index+1));
  }
  assert.equal(trackListNumber(0,1,{key:'sequence',direction:'desc'}), 1);
});
