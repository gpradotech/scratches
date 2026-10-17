import {test} from 'node:test';
import assert from 'node:assert/strict';
import {splitTags} from './tags.ts';

const splitThemes = (current: string[], input: string, finish = false) => splitTags(current, input, 'themes', finish);

test('vírgula transforma temas completos em chips e preserva o texto ainda em digitação', () => {
  assert.deepEqual(splitThemes([], 'Amor, Paixão,'), {tags: ['amor', 'paixão'], draft: '', error: ''});
  assert.deepEqual(splitThemes([], 'Amor, Paixão'), {tags: ['amor'], draft: ' Paixão', error: ''});
  assert.deepEqual(splitThemes(['amor'], ' Paixão', true), {tags: ['amor', 'paixão'], draft: '', error: ''});
});

test('normalização usa minúsculas, conserva acentos e não duplica temas equivalentes', () => {
  const result = splitThemes(['AMOR', 'Paixão'], 'amor, PAIXAO,   AMOR   PRÓPRIO, amor próprio,');
  assert.deepEqual(result.tags, ['amor', 'paixão', 'amor próprio']);
  assert.equal(result.error, '');
  assert.deepEqual(splitThemes([], 'PAIXA\u0303O,').tags, ['paixão']);
});

test('salvar ou sair do campo inclui o último tema mesmo sem vírgula e ignora termos vazios', () => {
  assert.deepEqual(splitThemes(['amor'], 'Protesto', true).tags, ['amor', 'protesto']);
  assert.deepEqual(splitThemes([], ', ,\n,', true), {tags: [], draft: '', error: ''});
});

test('tema além de 100 caracteres permanece disponível para correção sem perder os anteriores', () => {
  const long = 'a'.repeat(101);
  const result = splitThemes(['amor'], 'Paz,' + long + ',Protesto,');
  assert.deepEqual(result.tags, ['amor', 'paz']);
  assert.equal(result.draft, long + ',Protesto,');
  assert.ok(result.error);
  assert.deepEqual(splitThemes([], 'a'.repeat(100), true).tags, ['a'.repeat(100)]);
});

test('limite de 30 temas não descarta o excedente e ainda permite remover duplicatas', () => {
  const current = Array.from({length: 30}, (_, i) => 'tema ' + i);
  const result = splitThemes(current, 'Novo tema', true);
  assert.deepEqual(result.tags, current);
  assert.equal(result.draft, 'Novo tema');
  assert.ok(result.error);
  assert.equal(splitThemes(current, 'TEMA 0,').error, '');
});

test('clima usa a mesma normalização e pode ser reconstruído do formato persistido', () => {
  const result = splitTags([], 'MELANCÓLICO, ESPERANÇOSO, melancolico,', 'mood', true);
  assert.deepEqual(result, {tags: ['melancólico', 'esperançoso'], draft: '', error: ''});
  assert.deepEqual(splitTags([], result.tags.join(', '), 'mood', true), result);
  assert.deepEqual(splitTags(result.tags, 'CALMO', 'mood', true).tags, ['melancólico', 'esperançoso', 'calmo']);
});

test('limite do clima considera todos os chips e separadores sem descartar excedentes', () => {
  const first = 'a'.repeat(48);
  const second = 'b'.repeat(50);
  const exact = splitTags([], first + ', ' + second, 'mood', true);
  assert.equal(exact.tags.join(', ').length, 100);
  assert.equal(exact.error, '');
  const overflow = splitTags(exact.tags, 'calmo, esperançoso,', 'mood');
  assert.deepEqual(overflow.tags, exact.tags);
  assert.equal(overflow.draft, 'calmo, esperançoso,');
  assert.ok(overflow.error);
  assert.equal(splitTags(exact.tags, second.toUpperCase(), 'mood', true).error, '');
  assert.deepEqual(splitTags([], 'a'.repeat(101), 'mood', true).tags, []);
});
