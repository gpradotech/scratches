export const columnBoundaries = {sequence: [0, 2], title: [2, 3], album: [3, 4], bpm: [4, 5]} as const;
export type ResizableTrackColumn = keyof typeof columnBoundaries;
const minimums = [24, 70, 140, 100, 56, 44];
const compactBoundaries = {sequence: [0, 1], title: [1, 2], bpm: [2, 3]} as const;
const compactMinimums = [24, 140, 56, 44];
export function trackColumnBounds(column: ResizableTrackColumn, compact = false): readonly [number, number] | null {
  return compact ? column === 'album' ? null : compactBoundaries[column] : columnBoundaries[column];
}

// A divisória redistribui o espaço entre duas colunas, sem alterar a largura da lista.
export function resizeTrackColumns(widths: readonly number[], column: ResizableTrackColumn, delta: number): number[] {
  const next = [...widths];
  if (![4, 6].includes(widths.length) || widths.some(width => !Number.isFinite(width) || width <= 0) || !Number.isFinite(delta)) return next;
  const bounds = trackColumnBounds(column, widths.length === 4);
  if (!bounds) return next;
  const [left, right] = bounds;
  const limits = widths.length === 4 ? compactMinimums : minimums;
  const change = Math.max(Math.min(widths[left], limits[left]) - widths[left], Math.min(delta, widths[right] - Math.min(widths[right], limits[right])));
  next[left] += change;
  next[right] -= change;
  return next;
}

export function trackColumnTemplate(widths: readonly number[]): string {
  return widths.map((width, index) => widths.length === 6 && index === 1 ? `${width}px` : `minmax(0,${width}fr)`).join(' ');
}
