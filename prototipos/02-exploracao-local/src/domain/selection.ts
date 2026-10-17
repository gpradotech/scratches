import {fragmentKey, makeFragment} from './model.ts';
import type {Fragment, Interval, Lyric} from './model.ts';

const words = new Intl.Segmenter('pt-BR', {granularity: 'word'});
const characters = new Intl.Segmenter('pt-BR', {granularity: 'grapheme'});
const numbers = new Intl.NumberFormat('pt-BR');

export function mergeSelectionRanges(ranges: readonly Interval[]) {
  const merged: Interval[] = [];
  for (const range of ranges.toSorted((a, b) => a.start - b.start)) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({...range});
  }
  return merged;
}

// Ctrl can leave several native ranges. Read each one before normalizing overlaps.
export function readSelectionRanges<Range>(selection: {rangeCount: number; getRangeAt: (index: number) => Range} | null, readRange: (range: Range) => Interval | null) {
  if (!selection) return [];
  const ranges: Interval[] = [];
  for (let index = 0; index < selection.rangeCount; index++) {
    const range = readRange(selection.getRangeAt(index));
    if (range) ranges.push(range);
  }
  return mergeSelectionRanges(ranges);
}

export function stageSelection(trackId: string, lyric: Lyric, current: Fragment[], ranges: readonly Interval[], replaceContained = false) {
  const normalized = mergeSelectionRanges(ranges);
  const base = replaceContained ? current.filter(fragment => !normalized.some(range => fragment.start >= range.start && fragment.end <= range.end)) : current;
  const keys = new Set(base.map(fragmentKey));
  const additions: Fragment[] = [];
  for (const range of normalized) {
    const fragment = makeFragment(trackId, lyric, range);
    const key = fragmentKey(fragment);
    if (keys.has(key)) continue;
    keys.add(key); additions.push(fragment);
  }
  return additions.length ? [...base, ...additions] : current;
}

export function selectionStats(text: string, ranges: readonly Interval[]) {
  const stats = {words: 0, characters: 0, spaces: 0, lineBreaks: 0, tabs: 0};
  for (const range of mergeSelectionRanges(ranges)) {
    const selected = text.slice(range.start, range.end);
    for (const word of words.segment(selected)) if (word.isWordLike) stats.words++;
    for (const {segment} of characters.segment(selected)) {
      stats.characters++;
      if (/^[\r\n\u2028\u2029]+$/u.test(segment)) stats.lineBreaks++;
      else if (segment === '\t') stats.tabs++;
      else if (/^\s$/u.test(segment)) stats.spaces++;
    }
  }
  return stats;
}

export function selectionDescription(text: string, ranges: readonly Interval[]) {
  const stats = selectionStats(text, ranges);
  const count = (value: number, singular: string, plural: string) => `${numbers.format(value)} ${value === 1 ? singular : plural}`;
  const whitespace = [
    stats.spaces ? count(stats.spaces, 'espaço', 'espaços') : '',
    stats.lineBreaks ? count(stats.lineBreaks, 'quebra de linha', 'quebras de linha') : '',
    stats.tabs ? count(stats.tabs, 'tabulação', 'tabulações') : '',
  ].filter(Boolean);
  return `${count(stats.words, 'palavra', 'palavras')} • ${count(stats.characters, 'caractere', 'caracteres')}${whitespace.length ? ' (' + whitespace.join(', ') + ')' : ''} ${stats.characters === 1 ? 'selecionado' : 'selecionados'}`;
}
