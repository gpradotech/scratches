import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogViewFromParams, catalogViewParams} from './catalogView.ts';
import {filtersFromParams, filtersToParams} from './search.ts';
import {pagination, paginationParams} from './pagination.ts';
import {sortingParams, sortFromParams} from './sorting.ts';

test('alternar lista e galeria preserva pesquisa, filtros, ordem, página e capacidade sem alterar a URL de origem', () => {
  const base = new URLSearchParams('q=amor&genre=Pop&genre=Rap&bpmMin=80&ordenar=bpm-desc&pagina=2&porPagina=25');
  const gallery = catalogViewParams(base, 'gallery');
  assert.equal(catalogViewFromParams(gallery), 'gallery');
  assert.equal(gallery.get('q'), 'amor');
  assert.deepEqual(filtersFromParams(gallery), filtersFromParams(base));
  assert.deepEqual(sortFromParams(gallery), sortFromParams(base));
  assert.deepEqual(pagination(80, gallery), pagination(80, base));
  assert.equal(base.has('visualizacao'), false);
  assert.equal(catalogViewParams(gallery, 'list').toString(), base.toString());
  assert.equal(catalogViewFromParams(new URLSearchParams(gallery.toString())), 'gallery');
});

test('busca filtrada, nova ordenação e paginação conservam a galeria; valores desconhecidos usam lista', () => {
  const gallery = new URLSearchParams('visualizacao=galeria&q=amor');
  const filtered = filtersToParams({...filtersFromParams(gallery), bpmMin: '90'}, gallery);
  const ordered = sortingParams(filtered, {key: 'title', direction: 'asc'});
  const paged = paginationParams(ordered, 2, 25);
  assert.equal(catalogViewFromParams(paged), 'gallery');
  assert.equal(paged.get('q'), 'amor');
  assert.equal(paged.get('bpmMin'), '90');
  assert.equal(paged.get('ordenar'), 'title-asc');
  assert.equal(paged.get('pagina'), '2');
  assert.equal(catalogViewFromParams(new URLSearchParams('visualizacao=desconhecida')), 'list');
});

test('discografia pode usar galeria por padrão e preservar a escolha explícita por lista', () => {
  const initial = new URLSearchParams('ordenarAlbuns=oldest&pagina=2');
  assert.equal(catalogViewFromParams(initial, 'gallery'), 'gallery');
  const list = catalogViewParams(initial, 'list', 'gallery');
  assert.equal(list.get('visualizacao'), 'lista');
  assert.equal(list.get('pagina'), '2');
  assert.equal(catalogViewFromParams(new URLSearchParams(list.toString()), 'gallery'), 'list');
  assert.equal(catalogViewParams(list, 'gallery', 'gallery').toString(), initial.toString());
});
