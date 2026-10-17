import {useLayoutEffect, useRef, useState} from 'react';
import {galleryPageSizes, galleryPagination, galleryPaginationParams, pagination, paginationParams, pageSizes} from './domain/pagination.ts';

// Measure the shared CSS grid instead of duplicating its responsive breakpoints.
export function useGalleryPagination(total: number, params: URLSearchParams, enabled: boolean) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!enabled || !grid) return;
    const measure = () => {
      const template = getComputedStyle(grid).gridTemplateColumns;
      const count = template === 'none' ? 1 : template.trim().split(/\s+/).length;
      setColumns(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [enabled, total]);
  return {
    gridRef,
    paging: enabled ? galleryPagination(total, params, columns) : pagination(total, params),
    pageSizeOptions: enabled ? galleryPageSizes(columns) : pageSizes,
    pageParams: (page: number, size: number) => enabled ? galleryPaginationParams(params, page, size, columns) : paginationParams(params, page, size),
  };
}
