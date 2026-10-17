import {test} from 'node:test';
import assert from 'node:assert/strict';
import {columnBoundaries, resizeTrackColumns, trackColumnBounds, trackColumnTemplate} from './columns.ts';

test('cada divisória altera apenas suas duas colunas e preserva a largura total e a capa', () => {
  const widths = [28, 70, 400, 300, 100, 90];
  for (const column of Object.keys(columnBoundaries) as (keyof typeof columnBoundaries)[]) {
    const [left, right] = columnBoundaries[column];
    const next = resizeTrackColumns(widths, column, 12);
    assert.equal(next[left], widths[left] + 12);
    assert.equal(next[right], widths[right] - 12);
    assert.equal(next.reduce((a,b)=>a+b), widths.reduce((a,b)=>a+b));
    next.forEach((width,index)=>{if(index!==left && index!==right) assert.equal(width,widths[index]);});
  }
  assert.deepEqual(widths, [28,70,400,300,100,90]);
});

test('arrastes extremos e teclado respeitam as larguras mínimas sem estourar a lista', () => {
  const widths = [28,70,400,300,100,90];
  assert.deepEqual(resizeTrackColumns(widths,'title',9999), [28,70,600,100,100,90]);
  assert.deepEqual(resizeTrackColumns(widths,'title',-9999), [28,70,140,560,100,90]);
  assert.deepEqual(resizeTrackColumns(widths,'sequence',-9999), [24,70,404,300,100,90]);
  assert.deepEqual(resizeTrackColumns(widths,'bpm',9999), [28,70,400,300,146,44]);
  const narrow = [24,70,110,80,56,44];
  assert.deepEqual(resizeTrackColumns(narrow,'title',10), narrow);
  assert.deepEqual(resizeTrackColumns(widths,'album',NaN), widths);
});

test('o layout mantém capa fixa e distribui proporcionalmente as demais colunas', () => {
  assert.equal(trackColumnTemplate([28,70,400,300,100,90]), 'minmax(0,28fr) 70px minmax(0,400fr) minmax(0,300fr) minmax(0,100fr) minmax(0,90fr)');
});

test('lista compacta por álbum preserva redimensionamento, largura total e limites das quatro colunas', () => {
  const widths = [28, 500, 72, 64];
  assert.deepEqual(trackColumnBounds('title', true), [1, 2]);
  assert.deepEqual(resizeTrackColumns(widths, 'title', 10), [28, 510, 62, 64]);
  assert.deepEqual(resizeTrackColumns(widths, 'title', 9999), [28, 516, 56, 64]);
  assert.deepEqual(resizeTrackColumns(widths, 'bpm', 9999), [28, 500, 92, 44]);
  assert.deepEqual(resizeTrackColumns(widths, 'album', 10), widths);
  assert.equal(trackColumnTemplate(widths), 'minmax(0,28fr) minmax(0,500fr) minmax(0,72fr) minmax(0,64fr)');
});
