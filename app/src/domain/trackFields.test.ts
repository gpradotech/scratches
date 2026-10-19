import {test} from 'node:test';
import assert from 'node:assert/strict';
import {durationInput, trackBpmInput} from './trackFields.ts';

test('duração HH:MM:SS ocupa as casas da direita e transporta minutos e segundos', () => {
  assert.deepEqual(['', '1', '12', '123', '1234', '12345', '123456'].map(durationInput), ['', '00:00:01', '00:00:12', '00:01:23', '00:12:34', '01:23:45', '12:34:56']);
  assert.deepEqual(['61', '610', '6100', '7755', '666666', '00:61:61', '99:59:59'].map(durationInput), ['00:01:01', '00:06:10', '01:01:00', '01:17:55', '67:07:06', '01:02:01', '99:59:59']);
  for (const invalid of ['abc', '3m25', '-325', '3,25', '1234567', '999999']) assert.equal(durationInput(invalid), null);
});

test('BPM limita três dígitos inteiros, duas casas e o teto 400, sem sinais ou notação científica', () => {
  for (const valid of ['', '1', '12,', '12,33', '99.99', '400', '400,00']) assert.equal(trackBpmInput(valid), valid);
  for (const invalid of ['12,333', '1234', '400,01', '401', '-1', '1e2', '12a', '.3']) assert.equal(trackBpmInput(invalid), null);
});
