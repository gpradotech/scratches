import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readSelectionRanges, selectionDescription, selectionStats, stageSelection} from './selection.ts';
import {emptyWorkspace, saveFragments} from './model.ts';
import type {Lyric} from './model.ts';

const whole = (text: string) => [{start: 0, end: text.length}];

test('conta palavras, caracteres e espaços sem aparar a seleção', () => {
  const text = 'Original ';
  assert.deepEqual(selectionStats(text, whole(text)), {words: 1, characters: 9, spaces: 1, lineBreaks: 0, tabs: 0});
  assert.equal(selectionDescription(text, whole(text)), '1 palavra • 9 caracteres (1 espaço) selecionados');
  assert.equal(selectionDescription('Original rude boy', whole('Original rude boy')), '3 palavras • 17 caracteres (2 espaços) selecionados');
  assert.equal(selectionDescription('a', whole('a')), '1 palavra • 1 caractere selecionado');
});

test('pontuação não vira palavra, e caracteres Unicode visíveis contam uma vez', () => {
  const text = 'Maçã, cafe\u0301! 👩🏽‍🎤';
  assert.deepEqual(selectionStats(text, whole(text)), {words: 2, characters: 13, spaces: 2, lineBreaks: 0, tabs: 0});
  assert.equal(selectionDescription('…', whole('…')), '0 palavras • 1 caractere selecionado');
});

test('seleção de várias linhas distingue espaços, quebras de linha e tabulações', () => {
  const text = 'Original \nrude\tboy';
  assert.deepEqual(selectionStats(text, whole(text)), {words: 3, characters: 18, spaces: 1, lineBreaks: 1, tabs: 1});
  assert.equal(selectionDescription(text, whole(text)), '3 palavras • 18 caracteres (1 espaço, 1 quebra de linha, 1 tabulação) selecionados');
  assert.equal(selectionStats('a\r\nb', whole('a\r\nb')).lineBreaks, 1);
});

test('trechos separados não são fundidos em uma palavra nem ganham espaços artificiais', () => {
  const text = 'Original rude boy';
  const ranges = [{start: 0, end: 8}, {start: 14, end: 17}];
  assert.deepEqual(selectionStats(text, ranges), {words: 2, characters: 11, spaces: 0, lineBreaks: 0, tabs: 0});
});

test('total não conta sobreposições ou duplicatas duas vezes e não modifica os trechos', () => {
  const text = 'Original rude boy';
  const ranges = [{start: 9, end: 17}, {start: 0, end: 13}, {start: 9, end: 17}];
  const original = structuredClone(ranges);
  assert.deepEqual(selectionStats(text, ranges), selectionStats(text, whole(text)));
  assert.deepEqual(ranges, original);
  assert.deepEqual(selectionStats(text, [{start: 0, end: 4}, {start: 4, end: 8}]), {words: 1, characters: 8, spaces: 0, lineBreaks: 0, tabs: 0});
});

test('Ctrl com duas palavras separadas lê todos os ranges, conta ambos e prepara dois trechos para salvar', () => {
  const lyric: Lyric = {trackId: 'test', revision: 'r1', text: 'Original rude boy\nOriginal rude boy', source: '', importedAt: '', languages: [], themes: [], mood: ''};
  const nativeRanges = [{start: 9, end: 13}, {start: 32, end: 35}];
  const visited: number[] = [];
  const selection = {rangeCount: 2, getRangeAt: (index: number) => {visited.push(index); return nativeRanges[index];}};
  const captured = readSelectionRanges(selection, range => range);
  assert.deepEqual(visited, [0, 1]);
  assert.equal(selectionDescription(lyric.text, captured), '2 palavras • 7 caracteres selecionados');
  const fragments = stageSelection(lyric.trackId, lyric, [], captured);
  assert.deepEqual(fragments.map(fragment => fragment.text), ['rude', 'boy']);
  const saved = saveFragments(emptyWorkspace(), '', fragments, 'Teste de seleção');
  assert.equal(saved.added, 2);
  assert.deepEqual(saved.project.fragments.map(fragment => [fragment.start, fragment.end]), [[9, 13], [32, 35]]);
  const mixed = stageSelection(lyric.trackId, lyric, [fragments[0]], captured);
  assert.deepEqual(mixed.map(fragment => fragment.text), ['rude', 'boy']);
  assert.equal(stageSelection(lyric.trackId, lyric, fragments, captured), fragments);
});

test('ranges fora da letra não descartam os válidos e a ordem inversa não perde trechos', () => {
  const nativeRanges = [null, {start: 32, end: 35}, {start: 9, end: 13}, {start: 9, end: 13}];
  assert.deepEqual(readSelectionRanges({rangeCount: nativeRanges.length, getRangeAt: index => nativeRanges[index]}, range => range), [{start: 9, end: 13}, {start: 32, end: 35}]);
  assert.deepEqual(readSelectionRanges(null, () => {throw new Error('Sem seleção');}), []);
});
