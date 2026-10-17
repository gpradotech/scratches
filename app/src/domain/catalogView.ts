export type CatalogView = 'list' | 'gallery';

export function catalogViewFromParams(params: URLSearchParams, defaultView: CatalogView = 'list'): CatalogView {
  const value = params.get('visualizacao');
  return value === 'galeria' ? 'gallery' : value === 'lista' ? 'list' : defaultView;
}

export function catalogViewParams(base: URLSearchParams, view: CatalogView, defaultView: CatalogView = 'list'): URLSearchParams {
  const params = new URLSearchParams(base);
  if (view === defaultView) params.delete('visualizacao');
  else params.set('visualizacao', view === 'gallery' ? 'galeria' : 'lista');
  return params;
}
