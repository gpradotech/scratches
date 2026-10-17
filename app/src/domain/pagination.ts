export const pageSizes = [10, 25, 50, 100] as const;
export function pagination(total: number, params: URLSearchParams) {
  const requestedSize = Number(params.get('porPagina'));
  const pageSize = pageSizes.find(size => size === requestedSize) ?? 10;
  return paginate(total, params, pageSize);
}
function paginate(total: number, params: URLSearchParams, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const value = params.get('pagina') ?? '1';
  const requestedPage = /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : 1;
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  return {total, page, pageSize, totalPages, start, end};
}
export type PaginationState = ReturnType<typeof pagination>;
const validColumns = (columns: number) => Number.isSafeInteger(columns) && columns > 0 ? columns : 1;
export function galleryPageSizes(columns: number) {
  const count = validColumns(columns);
  return [...new Set(pageSizes.map(size => Math.ceil(size / count) * count))];
}
export function galleryPagination(total: number, params: URLSearchParams, columns: number): PaginationState {
  const count = validColumns(columns);
  const requested = pagination(total, params).pageSize;
  return paginate(total, params, Math.ceil(requested / count) * count);
}
export function galleryPaginationParams(base: URLSearchParams, page: number, pageSize: number, columns: number) {
  const count = validColumns(columns);
  const requested = pageSizes.find(size => Math.ceil(size / count) * count === pageSize) ?? pagination(0, base).pageSize;
  return paginationParams(base, page, requested);
}
export function paginationParams(base: URLSearchParams, page: number, pageSize: number) {
  const params = new URLSearchParams(base);
  if (page > 1) params.set('pagina', String(page)); else params.delete('pagina');
  if (pageSize !== 10) params.set('porPagina', String(pageSize)); else params.delete('porPagina');
  return params;
}
