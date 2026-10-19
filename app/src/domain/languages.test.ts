import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allLanguageOptions, customLanguage, loadLanguageCatalog, searchLanguages, suggestLanguages} from './languages.ts';
import {emptyWorkspace, validateWorkspace} from './model.ts';

test('catálogo internacional permite encontrar idiomas por nome traduzido, inglês ou código', async () => {
  assert.equal(suggestLanguages([], [], [])[0].label, 'Português');
  assert.equal(suggestLanguages([], [], []).length, 12);
  const catalog = await loadLanguageCatalog();
  assert.ok(catalog.length > 7000);
  for (const [query, code] of [['frances', 'fra'], ['Japanese', 'jpn'], ['yor', 'yor'], ['Nheengatu', 'yrl']]) {
    assert.ok(searchLanguages(catalog, query, [], []).some(option => option.codes.includes(code)), query);
  }
  const portuguese = searchLanguages(catalog, 'por', [], []).find(option => option.codes.includes('por'))!;
  assert.equal(customLanguage('Português').value, portuguese.value);
  assert.equal(searchLanguages(catalog, 'portugues', [], ['Português']).some(option => option.value === portuguese.value), true);
  const all = allLanguageOptions(catalog, ['Idioma criado pelo usuário'], []);
  assert.ok(catalog.every(option => all.some(item => item.value === option.value)));
  assert.equal(all[0].label, 'Idioma criado pelo usuário');
});

test('nomes locais continuam selecionáveis e não há limite fixo de idiomas no backup', async () => {
  const catalog = await loadLanguageCatalog();
  const local = 'Variante regional de teste';
  assert.equal(searchLanguages(catalog, local, [local], [])[0].label, local);
  const languages = [...catalog.slice(0, 40).map(option => option.label), local];
  const workspace = {...emptyWorkspace(), lyrics: {test: {trackId: 'test', text: 'Texto técnico de teste', revision: 'test', source: 'Teste automatizado', importedAt: new Date().toISOString(), languages, themes: [], mood: ''}}};
  const restored: unknown = JSON.parse(JSON.stringify(workspace));
  validateWorkspace(restored);
  assert.deepEqual(restored.lyrics.test.languages, languages);
});

test('sugestões priorizam o acervo e mantêm idiomas selecionados sem duplicações', async () => {
  const catalog = await loadLanguageCatalog();
  const firstUse = suggestLanguages(catalog, [], ['Português']);
  assert.equal(firstUse[0].label, 'Português');
  assert.ok(firstUse.some(option => option.codes.includes('jpn')));
  assert.equal(firstUse.some(option => option.label === 'Português'), true);
  const saved = ['Variante regional de teste', 'Francês', 'Francês', 'Português'];
  const suggestions = suggestLanguages(catalog, saved, ['Português']);
  assert.deepEqual(suggestions.slice(0, 3).map(option => option.label), ['Francês', 'Português', 'Variante regional de teste']);
  assert.equal(new Set(suggestions.map(option => option.value)).size, suggestions.length);
  assert.equal(suggestLanguages(catalog, saved, ['Português', 'Francês']).some(option => option.label === 'Francês'), true);
  assert.ok(suggestLanguages(catalog, saved, []).some(option => option.label === 'Português'));
  const selected = ['Idioma personalizado', catalog.find(option => option.codes.includes('yor'))!.label];
  assert.ok(selected.every(label => suggestLanguages(catalog, [], selected).some(option => option.label === label)));
  assert.equal(searchLanguages(catalog, 'idioma personalizado', [], selected)[0].label, 'Idioma personalizado');
});
