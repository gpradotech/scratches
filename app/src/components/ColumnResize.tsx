import {useEffect, useRef, useState} from 'react';
import type {RefObject} from 'react';
import {trackColumnBounds, resizeTrackColumns} from '../domain/columns.ts';
import type {ResizableTrackColumn} from '../domain/columns.ts';
import {sortLabels} from '../domain/sorting.ts';

export function useColumnMeasurements(bar: RefObject<HTMLDivElement | null>) {
  const [widths, setWidths] = useState<number[]>([]);
  useEffect(() => {
    const element = bar.current;
    if (!element) return;
    const measure = () => {
      const measured = getComputedStyle(element).gridTemplateColumns.split(' ').map(parseFloat);
      if ([4, 6].includes(measured.length) && measured.every(Number.isFinite)) setWidths(previous => previous.join() === measured.join() ? previous : measured);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [bar]);
  return {widths, setWidths};
}

export function ColumnResize({column, bar, widths, onResize, compact = false}: {column: ResizableTrackColumn; bar: RefObject<HTMLDivElement | null>; widths: number[]; onResize: (widths: number[] | null) => void; compact?: boolean}) {
  const drag = useRef<{pointer: number; x: number; widths: number[]} | null>(null);
  const [dragging, setDragging] = useState(false);
  const readWidths = () => bar.current ? getComputedStyle(bar.current).gridTemplateColumns.split(' ').map(parseFloat) : [];
  const bounds = trackColumnBounds(column, compact);
  if (!bounds) return null;
  const [left, right] = bounds;
  const count = compact ? 4 : 6;
  const value = widths[left] ?? 0;
  const minimum = widths.length === count ? resizeTrackColumns(widths, column, -Number.MAX_SAFE_INTEGER)[left] : 0;
  const maximum = widths.length === count ? resizeTrackColumns(widths, column, Number.MAX_SAFE_INTEGER)[left] : 0;
  return <div className={'track-column-resize' + (dragging ? ' dragging' : '')} role="separator" tabIndex={0} aria-orientation="vertical"
    aria-label={'Largura da coluna ' + sortLabels[column]} aria-valuemin={Math.round(minimum)} aria-valuemax={Math.round(maximum)} aria-valuenow={Math.round(value)} aria-valuetext={`${Math.round(value)} pixels`}
    title={'Ajustar largura de ' + sortLabels[column] + ': arraste ou use as setas do teclado'}
    onPointerDown={event => {
      if (event.button !== 0) return;
      const measured = readWidths();
      if (measured.length !== count) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.focus();
      drag.current = {pointer: event.pointerId, x: event.clientX, widths: measured};
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }}
    onPointerMove={event => {
      const start = drag.current;
      if (start?.pointer === event.pointerId) onResize(resizeTrackColumns(start.widths, column, event.clientX - start.x));
    }}
    onPointerUp={event => {
      if (drag.current?.pointer !== event.pointerId) return;
      drag.current = null; setDragging(false);
      event.currentTarget.releasePointerCapture(event.pointerId);
    }}
    onPointerCancel={() => {if (drag.current) onResize(drag.current.widths); drag.current = null; setDragging(false);}}
    onLostPointerCapture={() => {drag.current = null; setDragging(false);}}
    onKeyDown={event => {
      if (event.key === 'Escape' && drag.current) {
        event.preventDefault(); onResize(drag.current.widths);
        const pointer = drag.current.pointer; drag.current = null; setDragging(false);
        event.currentTarget.releasePointerCapture(pointer);
        return;
      }
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const measured = readWidths();
      if (measured.length !== count) return;
      event.preventDefault(); event.stopPropagation();
      const delta = event.key === 'Home' ? -measured[left] : event.key === 'End' ? measured[right] : (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : 10);
      onResize(resizeTrackColumns(measured, column, delta));
    }}/>
}
