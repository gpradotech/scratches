import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

const src = new URL('../', import.meta.url);
test('telas utilizam os controles compartilhados em vez de criar novos botões e links locais', async () => {
  const files = ['App.tsx', ...(await readdir(new URL('components/', src)))
    .filter(name => name.endsWith('.tsx') && name !== 'Controls.tsx').map(name => 'components/' + name)];
  for (const file of files) {
    const source = await readFile(new URL(file, src), 'utf8');
    assert.equal((source.match(/<a\s/g) ?? []).length, file === 'App.tsx' ? 1 : 0, `${file}: use TextLink, SurfaceLink ou ButtonLink; a exceção é o salto acessível para o conteúdo.`);
    assert.equal((source.match(/<button\s/g) ?? []).length, file === 'components/Search.tsx' ? 1 : 0, `${file}: use Button, TextAction ou IconButton; a exceção é a opção do widget de busca.`);
  }
});
test('estados hover dos controles não são sobrescritos nas folhas de layout das telas', async () => {
  const css = await readFile(new URL('styles.css', src), 'utf8');
  const widgetSelectors = ['.search-opener:hover', '.track-row:hover', '.command-option:hover', '.track-sort-bar:hover', '.track-column-resize:hover'];
  for (const [, selector] of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    if (!selector.includes(':hover')) continue;
    assert.ok(widgetSelectors.some(widget => selector.trim().startsWith(widget)), `Estado local de controle deve ser movido para controls.css: ${selector.trim()}`);
  }
});
