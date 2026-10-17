import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pagination, paginationParams, galleryPageSizes, galleryPagination, galleryPaginationParams} from './pagination.ts';
import {emptyFilters, filtersToParams} from './search.ts';

test('35 músicas são divididas em páginas sem perdas ou duplicações', () => {
  const tracks = Array.from({length: 35}, (_, index) => index);
  const pages = [1, 2, 3, 4].map(page => pagination(35, new URLSearchParams({pagina: String(page)})));
  assert.deepEqual(pages.map(p => p.end - p.start), [10, 10, 10, 5]);
  assert.deepEqual(pages.flatMap(p => tracks.slice(p.start, p.end)), tracks);
  assert.equal(pages[3].totalPages, 4);
  assert.equal(pagination(35, new URLSearchParams('porPagina=25')).totalPages, 2);
  assert.equal(pagination(35, new URLSearchParams('porPagina=50')).end, 35);
});

test('página e capacidade inválidas não produzem lista vazia ou intervalo fora dos resultados', () => {
  assert.equal(pagination(35, new URLSearchParams('pagina=999')).page, 4);
  for (const pagina of ['0', '-2', 'abc', '1.5', '1e2', 'Infinity', '999999999999999999999']) {
    assert.equal(pagination(35, new URLSearchParams({pagina})).page, 1);
  }
  assert.equal(pagination(35, new URLSearchParams('porPagina=0')).pageSize, 10);
  const empty = pagination(0, new URLSearchParams('pagina=2'));
  assert.deepEqual([empty.start, empty.end, empty.page, empty.totalPages], [0, 0, 1, 1]);
  const reduced = pagination(3, new URLSearchParams('pagina=4'));
  assert.deepEqual([reduced.start, reduced.end, reduced.page], [0, 3, 1]);
});

test('navegação preserva consulta e filtros múltiplos; trocar filtros reinicia apenas a página', () => {
  const base = new URLSearchParams('q=rap&genre=Rap&genre=Pop&porPagina=25');
  const next = paginationParams(base, 2, 25);
  assert.equal(next.get('q'), 'rap'); assert.deepEqual(next.getAll('genre'), ['Rap', 'Pop']);
  assert.equal(pagination(35, next).page, 2);
  const filtered = filtersToParams({...emptyFilters, genre: ['Rap', 'Pop']}, next);
  assert.equal(filtered.has('pagina'), false); assert.equal(filtered.get('porPagina'), '25');
  assert.equal(filtered.get('q'), 'rap');
  const first = paginationParams(next, 1, 10);
  assert.equal(first.has('pagina'), false); assert.equal(first.has('porPagina'), false);
  assert.equal(base.has('pagina'), false);
});

test('galeria completa todas as linhas antes da última página, sem perdas ou duplicações', () => {
  for (const columns of [1, 2, 3, 4, 5, 6, 7]) {
    for (const requestedSize of [10, 25, 50, 100]) {
      for (const total of [0, 1, 10, 25, 35, 101, 203]) {
        const base = new URLSearchParams({porPagina: String(requestedSize)});
        const first = galleryPagination(total, base, columns);
        assert.equal(first.pageSize % columns, 0);
        assert.ok(first.pageSize >= requestedSize && first.pageSize < requestedSize + columns);
        const items = Array.from({length: total}, (_, i) => i);
        const visited: number[] = [];
        for (let page = 1; page <= first.totalPages; page++) {
          const state = galleryPagination(total, galleryPaginationParams(base, page, first.pageSize, columns), columns);
          if (page < first.totalPages) assert.equal((state.end - state.start) % columns, 0);
          visited.push(...items.slice(state.start, state.end));
        }
        assert.deepEqual(visited, items);
      }
    }
  }
  assert.deepEqual([1, 2, 3].map(page => {
    const state = galleryPagination(35, new URLSearchParams({pagina: String(page)}), 6);
    return state.end - state.start;
  }), [12, 12, 11]);
});

test('capacidade efetiva da galeria acompanha colunas, conserva URL e mantém capacidade original na lista', () => {
  const base = new URLSearchParams('q=rap&genre=Rap&genre=Pop&visualizacao=galeria&ordenar=title-asc&porPagina=25&pagina=2');
  assert.deepEqual(galleryPageSizes(6), [12, 30, 54, 102]);
  assert.deepEqual(galleryPageSizes(5), [10, 25, 50, 100]);
  assert.equal(galleryPagination(101, base, 6).pageSize, 30);
  assert.equal(galleryPagination(101, base, 5).pageSize, 25);
  assert.equal(pagination(101, base).pageSize, 25);
  const next = galleryPaginationParams(base, 3, 30, 6);
  assert.equal(next.get('porPagina'), '25');
  assert.equal(next.get('pagina'), '3');
  assert.equal(next.get('q'), 'rap');
  assert.equal(next.get('ordenar'), 'title-asc');
  assert.deepEqual(next.getAll('genre'), ['Rap', 'Pop']);
  assert.equal(galleryPagination(101, next, 6).start, 60);
  assert.equal(galleryPaginationParams(base, 1, 12, 6).has('porPagina'), false);
  assert.equal(base.get('pagina'), '2');
});

test('redimensionar o grid não deixa página vazia e colunas inválidas usam capacidade segura', () => {
  const params = new URLSearchParams('pagina=4');
  assert.deepEqual([galleryPagination(35, params, 5).page, galleryPagination(35, params, 6).page], [4, 3]);
  for (const columns of [0, -1, 1.5, Infinity, NaN]) {
    assert.equal(galleryPagination(35, params, columns).pageSize, 10);
  }
  const empty = galleryPagination(0, params, 6);
  assert.deepEqual([empty.start, empty.end, empty.totalPages], [0, 0, 1]);
});
