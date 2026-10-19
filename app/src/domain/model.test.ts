import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assessFragmentSelection, emptyWorkspace, fragmentLines, lineAt, lyricLanguages, makeFragment, saveFragments, validateWorkspace} from './model.ts';
import type {Catalog, Lyric, Track} from './model.ts';
import {emptyFilters, filtersFromParams, searchAll, searchCatalog, searchPassages} from './search.ts';
const lyric: Lyric = {trackId: 'test-song', text: 'Texto de teste A\nTexto de teste B\nTexto de teste C', revision: 'version-1', source: 'Teste automatizado; não é letra musical', importedAt: new Date().toISOString(), language: 'Português', themes: ['teste'], mood: ''};
const t: Track = {id: 'test-song', title: 'Título', artists: [{id: 'artista', name: 'Artista'}], album: 'Álbum', duration: 120, cover: null, bpm: null, key: null, mode: null, genres: [], genreScope: 'album', releaseDate: null, catalogAlbum: null, source: null, sourceMatch: 'test', lyricsReferences: [], isrc: null};
const catalog: Catalog = {tracks: [t], artists: [{id: 'artista', name: 'Artista', picture: null}]};
const multilingual: Lyric = {trackId: t.id, text: lyric.text, revision: lyric.revision, source: lyric.source,
  importedAt: lyric.importedAt, languages: ['Português', 'Inglês'], themes: lyric.themes, mood: lyric.mood};

test('numeração ignora separadores e preserva os offsets dos trechos entre parágrafos', () => {
  const text = '\nPrimeiro verso 🎵\nSegundo verso\n\n \nTerceiro verso\nQuarto verso';
  const local = {...multilingual, text};
  const start = text.indexOf('Segundo'); const end = text.indexOf('Terceiro') + 'Terceiro verso'.length;
  assert.equal(lineAt(text, 0), 1);
  assert.equal(lineAt(text, text.indexOf('Terceiro')), 3);
  assert.equal(lineAt(text, text.indexOf('Quarto') + 4), 4);
  const fragment = makeFragment(t.id, local, {start, end});
  assert.equal(fragment.startLine, 2); assert.equal(fragment.endLine, 3);
  assert.equal(fragment.text, 'Segundo verso\n\n \nTerceiro verso');
  const legacy = {...fragment, startLine: 3, endLine: 6};
  assert.deepEqual(fragmentLines(legacy, local), {startLine: 2, endLine: 3});
  assert.deepEqual(fragmentLines(legacy, {...local, revision: 'outra'}), {startLine: 3, endLine: 6});
  assert.equal(legacy.startLine, 3);
});

test('resultados de busca usam a mesma numeração contínua da leitura', () => {
  const text = 'Primeiro verso\n\n \nSegundo verso\nTerceiro verso';
  const workspace = {...emptyWorkspace(), lyrics: {[t.id]: {...multilingual, text}}};
  const [single] = searchPassages(catalog, 'Segundo', emptyFilters, workspace);
  assert.equal(single.startLine, 2); assert.equal(single.endLine, 2);
  assert.equal(single.start, text.indexOf('Segundo'));
  const [phrase] = searchPassages(catalog, 'Segundo verso Terceiro', emptyFilters, workspace);
  assert.equal(phrase.startLine, 2); assert.equal(phrase.endLine, 3);
  assert.equal(text.slice(phrase.start, phrase.end), phrase.text);
});

test('cada idioma da mesma letra encontra a música e seus trechos', () => {
  const workspace = {...emptyWorkspace(), lyrics: {[t.id]: multilingual}};
  validateWorkspace(workspace);
  for (const language of ['Português', 'Inglês', 'ingles']) {
    const filters = {...emptyFilters, language: [language]};
    assert.equal(searchAll(catalog, 'Artista', filters, workspace).tracks.length, 1);
    assert.equal(searchAll(catalog, 'teste', filters, workspace).passages.length, 3);
  }
  assert.equal(searchAll(catalog, '', {...emptyFilters, language: ['Espanhol']}, workspace).tracks.length, 0);
});

test('idioma legado e ausência de idiomas mantêm a compatibilidade com os filtros', () => {
  const legacy = {...emptyWorkspace(), lyrics: {[t.id]: lyric}};
  validateWorkspace(legacy);
  assert.deepEqual(lyricLanguages(lyric), ['Português']);
  assert.equal(searchCatalog(catalog, '', {...emptyFilters, language: ['Português']}, legacy).tracks.length, 1);
  const unspecified = {...multilingual, languages: []};
  const workspace = {...emptyWorkspace(), lyrics: {[t.id]: unspecified}};
  validateWorkspace(workspace);
  assert.deepEqual(lyricLanguages(unspecified), []);
  assert.equal(searchCatalog(catalog, '', {...emptyFilters, language: ['Inglês']}, workspace).tracks.length, 0);
  assert.equal(searchCatalog(catalog, '', emptyFilters, workspace).tracks.length, 1);
});

test('backup recusa idiomas inválidos e preserva a lista no ciclo de exportação e importação', () => {
  const workspace = {...emptyWorkspace(), lyrics: {[t.id]: multilingual}};
  const restored: unknown = JSON.parse(JSON.stringify(workspace));
  validateWorkspace(restored);
  assert.deepEqual(lyricLanguages(restored.lyrics[t.id]), ['Português', 'Inglês']);
  for (const languages of ['Português', [''], ['Português', 42], ['Português', 'portugues'], Array(31).fill('Inglês')]) {
    assert.throws(() => validateWorkspace({...workspace, lyrics: {[t.id]: {...multilingual, languages}}}));
  }
  assert.throws(() => validateWorkspace({...workspace, lyrics: {[t.id]: {...multilingual, language: 'Português'}}}));
});
test('seleções sem limite de dois, com linhas e texto preservados', () => {
  const selections = [0, lyric.text.indexOf('Texto de teste B'), lyric.text.indexOf('Texto de teste C')].map(start => makeFragment(t.id, lyric, {start, end: start + 5}));
  const result = saveFragments(emptyWorkspace(), '', selections, 'Minha linha');
  assert.equal(result.project.fragments.length, 3); assert.equal(result.project.fragments[1].startLine, 2);
  validateWorkspace(result.workspace);
});
test('salvar duas vezes evita duplicação e não altera o conteúdo anterior', () => {
  const f = makeFragment(t.id, lyric, {start: 0, end: 10});
  const first = saveFragments(emptyWorkspace(), '', [f], 'Teste');
  const second = saveFragments(first.workspace, first.project.id, [{...f, id: 'other'}]);
  assert.equal(second.added, 0); assert.equal(second.duplicates, 1); assert.equal(second.project.fragments.length, 1);
  assert.equal(second.workspace, first.workspace);
  assert.equal(second.project.updatedAt, first.project.updatedAt);
});

test('prévia do destino identifica seleção totalmente duplicada antes de gravar', () => {
  const fragment = makeFragment(t.id, lyric, {start: 0, end: 10});
  const first = saveFragments(emptyWorkspace(), '', [fragment], 'Teste');
  const preview = assessFragmentSelection(first.project, [{...fragment, id: 'new-id'}]);
  assert.equal(preview.additions.length, 0);
  assert.equal(preview.duplicates, 1);
});

test('seleção mista adiciona somente os trechos novos e mantém a prévia coerente', () => {
  const firstFragment = makeFragment(t.id, lyric, {start: 0, end: 10});
  const nextFragment = makeFragment(t.id, lyric, {start: 12, end: 17});
  const first = saveFragments(emptyWorkspace(), '', [firstFragment], 'Teste');
  const fragments = [{...firstFragment, id: 'duplicate'}, nextFragment, {...nextFragment, id: 'also-duplicate'}];
  const preview = assessFragmentSelection(first.project, fragments);
  const result = saveFragments(first.workspace, first.project.id, fragments);
  assert.equal(preview.additions.length, 1);
  assert.equal(preview.duplicates, 2);
  assert.equal(result.added, preview.additions.length);
  assert.equal(result.duplicates, preview.duplicates);
  assert.deepEqual(result.project.fragments, [firstFragment, nextFragment]);
  validateWorkspace(result.workspace);
});

test('prevenção de duplicados distingue projetos, músicas, versões e intervalos', () => {
  const fragment = makeFragment(t.id, lyric, {start: 0, end: 10});
  const first = saveFragments(emptyWorkspace(), '', [fragment], 'Teste');
  for (const alternative of [{...fragment, trackId: 'another-song'}, {...fragment, lyricRevision: 'new-version'}, {...fragment, start: 1, end: 11}]) {
    assert.equal(assessFragmentSelection(first.project, [alternative]).additions.length, 1);
  }
  assert.equal(assessFragmentSelection({...first.project, id: 'empty-project', fragments: []}, [fragment]).additions.length, 1);
});
test('trocar letra preserva a cópia dos trechos salvos', () => {
  const f = makeFragment(t.id, lyric, {start: 0, end: 10});
  const first = saveFragments(emptyWorkspace(), '', [f], 'Teste').workspace;
  const next = {...first, lyrics: {[t.id]: {...lyric, text: 'Outro texto', revision: 'version-2'}}};
  validateWorkspace(next); assert.equal(next.projects[0].fragments[0].text, 'Texto de t'); assert.equal(next.projects[0].fragments[0].lyricRevision, 'version-1');
});
test('intervalos inválidos, vazios e nomes vazios são recusados', () => {
  assert.throws(() => makeFragment(t.id, lyric, {start: -1, end: 8}));
  assert.throws(() => makeFragment(t.id, lyric, {start: 3, end: 3}));
  assert.throws(() => saveFragments(emptyWorkspace(), '', [], '   '));
});
test('backup inconsistente não é aceito', () => {
  assert.throws(() => validateWorkspace({schema: 1}));
  const w = saveFragments(emptyWorkspace(), '', [makeFragment(t.id, lyric, {start: 0, end: 5})], 'Teste').workspace;
  w.projects[0].fragments[0].end = 90;
  assert.throws(() => validateWorkspace(w));
});
test('busca encontra título sem acento e um único artista, sem exigir texto de letra', () => {
  assert.equal(searchCatalog(catalog, 'titulo', emptyFilters, emptyWorkspace()).tracks.length, 1);
  const result = searchCatalog(catalog, 'artista', emptyFilters, emptyWorkspace());
  assert.equal(result.tracks.length, 1); assert.equal(result.artists.length, 1);
});
test('atributo ausente é aceito no estado neutro e excluído pelo filtro correspondente', () => {
  assert.equal(searchCatalog(catalog, '', emptyFilters, emptyWorkspace()).tracks.length, 1);
  assert.equal(searchCatalog(catalog, '', {...emptyFilters, bpmMin: '80'}, emptyWorkspace()).tracks.length, 0);
  assert.equal(searchCatalog(catalog, '', {...emptyFilters, hasBpm: true}, emptyWorkspace()).tracks.length, 0);
  assert.equal(searchCatalog(catalog, '', {...emptyFilters, hasTonality: true}, emptyWorkspace()).tracks.length, 0);
});
test('fragmentos são recuperados somente de textos locais e conservam intervalos', () => {
  assert.equal(searchPassages(catalog, 'teste', emptyFilters, emptyWorkspace()).length, 0);
  const w = {...emptyWorkspace(), lyrics: {[t.id]: lyric}};
  const results = searchPassages(catalog, 'teste B', emptyFilters, w);
  assert.equal(results.length, 1); assert.equal(results[0].startLine, 2);
  assert.equal(lyric.text.slice(results[0].start, results[0].end), results[0].text);
});

test('busca reúne versos repetidos por música e mantém a primeira ocorrência navegável', () => {
  const text = 'Linha de teste\nOutra linha de teste\n\nLinha de teste\n LINHA  DE TESTE \nLinha de teste!';
  const workspace = {...emptyWorkspace(), lyrics: {[t.id]: {...lyric, text}}};
  const results = searchAll(catalog, 'teste', emptyFilters, workspace).passages;
  assert.deepEqual(results.map(r => r.text), ['Linha de teste', 'Outra linha de teste', 'Linha de teste!']);
  assert.equal(results[0].start, 0); assert.equal(results[0].startLine, 1);
  for (const r of results) assert.equal(text.slice(r.start, r.end), r.text);
  assert.equal(workspace.lyrics[t.id].text, text);
});

test('repetições em duas linhas também são agrupadas sem unir músicas diferentes', () => {
  const text = 'Primeira parte\nsegunda parte\n\nPrimeira parte\nsegunda parte';
  const second = {...t, id: 'outra-musica'};
  const workspace = {...emptyWorkspace(), lyrics: {
    [t.id]: {...lyric, text}, [second.id]: {...lyric, trackId: second.id, text},
  }};
  const results = searchPassages({...catalog, tracks: [t, second]}, 'parte segunda', emptyFilters, workspace);
  assert.equal(results.length, 2);
  assert.deepEqual(results.map(r => r.track.id), [t.id, second.id]);
  for (const r of results) {
    assert.equal(r.start, 0); assert.equal(r.startLine, 1); assert.equal(r.endLine, 2);
    assert.equal(text.slice(r.start, r.end), r.text);
  }
});
test('a mesma consulta retorna artista, música e trechos sem escolher uma modalidade', () => {
  const mixed: Catalog = {tracks: [{...t, title: 'Teste', artists: [{id: 'artista', name: 'Artista Teste'}]}], artists: [{id: 'artista', name: 'Artista Teste', picture: null}]};
  const workspace = {...emptyWorkspace(), lyrics: {[t.id]: lyric}};
  const results = searchAll(mixed, 'teste', emptyFilters, workspace);
  assert.equal(results.artists.length, 1); assert.equal(results.tracks.length, 1); assert.equal(results.passages.length, 3);
  assert.equal(lyric.text.slice(results.passages[1].start, results.passages[1].end), results.passages[1].text);
  const filtered = searchAll(mixed, 'teste', {...emptyFilters, bpmMin: '80'}, workspace);
  assert.deepEqual(filtered, {artists: [], tracks: [], passages: []});
});
test('uma consulta encontrada somente na letra continua produzindo resultados', () => {
  const results = searchAll(catalog, 'texto', emptyFilters, {...emptyWorkspace(), lyrics: {[t.id]: lyric}});
  assert.equal(results.artists.length, 0); assert.equal(results.tracks.length, 0); assert.equal(results.passages.length, 3);
});
test('links antigos com modo não limitam a busca e preservam os filtros', () => {
  const oldCatalog = filtersFromParams(new URLSearchParams('modo=catalogo&bpmMin=80&unknown=1'));
  const oldPassages = filtersFromParams(new URLSearchParams('modo=trechos&bpmMin=80&unknown=1'));
  assert.deepEqual(oldCatalog, oldPassages); assert.equal(oldCatalog.bpmMin, '80'); assert.equal(oldCatalog.hasBpm, false); assert.equal(oldCatalog.hasTonality, false); assert.equal(oldCatalog.hasLyrics, false);
  const results = searchAll({...catalog, tracks: [{...t, bpm: 88.5}]}, 'texto', oldCatalog, {...emptyWorkspace(), lyrics: {[t.id]: lyric}});
  assert.equal(results.passages.length, 3);
});
