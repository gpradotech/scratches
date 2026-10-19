import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
test('espaçamentos de layout usam múltiplos de oito; um pixel fica reservado ao recorte acessível', async () => {
  async function check(directory: URL) {
    for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      if (entry.isDirectory()) {await check(file); continue;}
      if (!entry.name.endsWith('.css')) continue;
      const css = await fs.readFile(file, 'utf8');
      for (const [, prop, value] of css.matchAll(/([\w-]+)\s*:\s*([^;{}]+)[;}]/g)) {
        if (!/^(margin|padding)(-|$)|^(gap|row-gap|column-gap|scroll-margin-top)$|^--.*gap$/.test(prop)) continue;
        for (const [, number] of value.matchAll(/(-?\d+(?:\.\d+)?)px\b/g)) {
          const n = Math.abs(Number(number)); assert.ok(n <= 1 || n % 8 === 0, `${entry.name}: ${prop}: ${value}`);
        }
      }
    }
  }
  await check(new URL('../', import.meta.url));
});
