import {Button, ButtonLink, FileButton, IconButton, TextAction, TextLink} from './Controls.tsx';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {Catalog, Fragment, Interval, Lyric, Track, Workspace} from '../domain/model.ts';
import {duration, fragmentLines, keyNames, lineAt, lyricLanguages} from '../domain/model.ts';
import {albumUrl, artistUrl} from '../routing.ts';
import {Cover, Dialog, Empty, Icon} from './UI.tsx';
import {SaveDialog} from './ProjectDialogs.tsx';
import type {Commit} from './ProjectDialogs.tsx';
import {LanguageSelect} from './LanguageSelect.tsx';
import {SongProjects} from './SongProjects.tsx';
import {TagInput} from './TagInput.tsx';
import {splitTags} from '../domain/tags.ts';
import {filterHelp} from '../domain/filterHelp.ts';
import {readSelectionRanges, selectionDescription, stageSelection} from '../domain/selection.ts';
function ImportLyric({track, current, commit, onClose, notify, knownLanguages}: {track: Track; current?: Lyric; commit: Commit; onClose: () => void; notify: (m: string) => void; knownLanguages: string[]}) {
  const [text, setText] = useState(current?.text ?? '');
  const [source, setSource] = useState(current?.source === 'Texto adicionado por você' ? '' : current?.source ?? '');
  const [languages, setLanguages] = useState(() => lyricLanguages(current));
  const [themes, setThemes] = useState(() => splitTags([], current?.themes.join(', ') ?? '', 'themes', true));
  const [mood, setMood] = useState(() => splitTags([], current?.mood ?? '', 'mood', true));
  const [pending, setPending] = useState(false); const [error, setError] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const busy = pending || reading;
  const importDisabled = busy || text.length > 0 || fileName !== null;
  async function file(file?: File) {
    if (!file || importDisabled) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.txt')) {setError('Escolha um arquivo .txt.'); return;}
    if (file.size > 200000) {setError('Escolha um arquivo de texto de até 200 KB.'); return;}
    setReading(true);
    try {
      const content = (await file.text()).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
      if (!content.trim()) {setError('O arquivo está vazio. Escolha um arquivo com texto.'); return;}
      if (content.length > 100000) {setError('A letra deve ter até 100.000 caracteres.'); return;}
      setText(content); setFileName(file.name);
    } catch {setError('Não foi possível ler o arquivo. Tente novamente.');}
    finally {setReading(false);}
  }
  async function save() {
    setPending(true); setError('');
    const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    try {
      const normalizedThemes = splitTags(themes.tags, themes.draft, 'themes', true);
      const normalizedMood = splitTags(mood.tags, mood.draft, 'mood', true);
      if (normalizedThemes.error) throw new Error(normalizedThemes.error);
      if (normalizedMood.error) throw new Error(normalizedMood.error);
      await commit(w => ({...w, lyrics: {...w.lyrics, [track.id]: {
        trackId: track.id, text: clean, revision: current?.text === clean ? current.revision : crypto.randomUUID(),
        source: source.trim(), importedAt: new Date().toISOString(), languages: [...languages],
        themes: normalizedThemes.tags, mood: normalizedMood.tags.join(', '),
      }}}));
      notify('Letra salva.'); onClose();
    } catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível salvar a letra.');}
    finally {setPending(false);}
  }
  return <Dialog title={current ? 'Editar letra' : 'Adicionar letra'} onClose={onClose} className="import-dialog">
    <p className="muted">{track.title} · {track.artists[0].name}</p>
    <FileButton ><Icon name="upload"/>Importar arquivo .txt<input type="file" accept=".txt,text/plain" disabled={importDisabled} aria-describedby="lyric-entry-help" onChange={e => {const selected = e.target.files?.[0]; e.target.value = ''; void file(selected);}}/></FileButton>
    {fileName && <div className="lyric-file"><span><Icon name="file"/><span>{fileName}</span></span><TextAction disabled={busy} onClick={() => {setFileName(null); setText(''); setError('');}}>Remover arquivo</TextAction></div>}
    <div className="form-field">
      <div className="lyric-entry-heading"><label htmlFor="lyric-import-text">{fileName ? 'Prévia do arquivo' : 'Ou cole a letra completa'}</label>{!fileName && text.length > 0 && <TextAction disabled={busy} onClick={() => {setText(''); setError('');}}>Limpar texto</TextAction>}</div>
      <textarea id="lyric-import-text" autoFocus rows={12} maxLength={100000} value={text} readOnly={fileName !== null || busy} aria-describedby="lyric-entry-help" onChange={e => {setText(e.target.value); setError('');}} placeholder="Cole a letra completa aqui."/>
      <p className="caption lyric-entry-help" id="lyric-entry-help" aria-live="polite">{reading ? 'Lendo arquivo…' : fileName ? 'Prévia somente para leitura. Remova o arquivo para digitar ou importar outro.' : text.length > 0 ? 'Para importar um arquivo, limpe o texto primeiro.' : 'Escolha um arquivo .txt ou cole o texto acima.'}</p>
    </div>
    <label className="form-field">Origem ou referência<input maxLength={500} value={source} onChange={e => setSource(e.target.value)} placeholder="Informe a origem, se desejar"/></label>
    <details className="optional-details"><summary>Informações opcionais para os filtros</summary><div className="import-metadata">
      <LanguageSelect value={languages} onChange={setLanguages} saved={knownLanguages} disabled={busy}/>
      <TagInput label="Temas" help={filterHelp.theme} kind="themes" value={themes} onChange={setThemes} disabled={busy}/>
      <TagInput label="Clima da letra" help={filterHelp.mood} kind="mood" value={mood} onChange={setMood} disabled={busy}/>
    </div></details>
    {current && <p className="caption">Os trechos já guardados nos projetos mantêm o texto e a versão originais.</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className="dialog-actions"><Button onClick={onClose} disabled={pending}>Cancelar</Button><Button variant="primary" disabled={busy || !text.trim()} onClick={() => void save()}>{pending ? 'Salvando…' : current ? 'Salvar letra' : 'Adicionar letra'}</Button></div>
  </Dialog>;
}
function HighlightedLine({text, offset, ranges, saved}: {text: string; offset: number; ranges: Interval[]; saved: Interval[]}) {
  const boundaries = new Set([0, text.length]);
  for (const r of [...ranges, ...saved]) {if (r.end > offset && r.start < offset + text.length) {boundaries.add(Math.max(0, r.start - offset)); boundaries.add(Math.min(text.length, r.end - offset));}}
  const points = [...boundaries].sort((a,b) => a-b);
  return <>{points.slice(0, -1).map((p, i) => {const end = points[i+1]; const selected = ranges.some(r => r.start < offset + end && r.end > offset + p); const stored = saved.some(r => r.start < offset + end && r.end > offset + p); return selected || stored ? <mark key={p} className={selected ? undefined : 'saved-highlight'}>{text.slice(p, end)}</mark> : <span key={p}>{text.slice(p, end)}</span>;})}{!text && '\u00a0'}</>;
}
export function Song({catalog, workspace, id, params, commit, notify, drafts, onDrafts, exploreUrl}: {exploreUrl: string; catalog: Catalog; workspace: Workspace; id: string; params: URLSearchParams; commit: Commit; notify: (m: string) => void; drafts: Fragment[]; onDrafts: (f: Fragment[]) => void}) {
  const track = catalog.tracks.find(t => t.id === id); const lyric = workspace.lyrics[id];
  const [importing, setImporting] = useState(false); const [saving, setSaving] = useState(false); const [candidates, setCandidates] = useState<Interval[]>([]);
  const body = useRef<HTMLDivElement>(null); const anchorLine = useRef<number | null>(null);
  const selected = drafts.filter(f => f.lyricRevision === lyric?.revision);
  const saved = useMemo(() => workspace.projects.flatMap(project => project.fragments.filter(fragment => fragment.trackId === id && fragment.lyricRevision === lyric?.revision)), [workspace.projects, id, lyric?.revision]);
  const contextRange = params.has('inicio') && lyric && params.get('rev') === lyric.revision ? {start: Number(params.get('inicio')), end: Number(params.get('fim'))} : null;
  const lines = useMemo(() => {
    let start = 0; let number = 0;
    return (lyric?.text ?? '').split('\n').map((text, sourceIndex) => {
      const line = {text, start, number: text.trim() ? ++number : 0, sourceIndex};
      start += text.length + 1;
      return line;
    }).filter(line => line.number > 0);
  }, [lyric?.text]);
  const savedLineProjects = useMemo(() => new Map(lines.map(line => [line.number,
    workspace.projects.filter(project => project.fragments.some(fragment => fragment.trackId === id && fragment.lyricRevision === lyric?.revision && fragment.start < line.start + line.text.length && fragment.end > line.start)).map(project => project.name),
  ])), [workspace.projects, id, lyric?.revision, lines]);
  const paragraphs = useMemo(() => {
    const groups: (typeof lines)[] = [];
    let paragraph: typeof lines = [];
    for (const line of lines) {
      if (paragraph.length && line.sourceIndex > paragraph[paragraph.length - 1].sourceIndex + 1) {groups.push(paragraph); paragraph = [];}
      paragraph.push(line);
    }
    if (paragraph.length) groups.push(paragraph);
    return groups;
  }, [lines]);
  useEffect(() => {if (contextRange && lyric) requestAnimationFrame(() => document.getElementById('lyric-line-' + lineAt(lyric.text, contextRange.start))?.scrollIntoView({block: 'center'}));}, [id, lyric?.revision, params.get('inicio')]);
  useEffect(() => {
    const clearInvalidSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !body.current?.contains(selection.anchorNode) || !body.current?.contains(selection.focusNode)) setCandidates([]);
    };
    document.addEventListener('selectionchange', clearInvalidSelection);
    return () => document.removeEventListener('selectionchange', clearInvalidSelection);
  }, []);
  if (!track) return <Empty title="Música não encontrada" action={<ButtonLink href="#/explorar">Voltar a Explorar</ButtonLink>}/>;
  const t = track;
  function add(ranges: Interval[], replaceContained = false) {
    if (!lyric) return;
    const next = stageSelection(id, lyric, selected, ranges, replaceContained);
    if (next === selected) {notify('Esse trecho já está na seleção.'); return;}
    onDrafts(next); setCandidates([]); window.getSelection()?.removeAllRanges();
  }
  function capture() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !body.current || !lyric) {setCandidates([]); return;}
    const lineElement = (node: Node) => (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-line-text]');
    const within = (span: HTMLElement, node: Node, end: number) => {const range = document.createRange(); range.selectNodeContents(span); range.setEnd(node, end); return range.toString().length;};
    setCandidates(readSelectionRanges(selection, range => {
      if (!body.current?.contains(range.startContainer) || !body.current.contains(range.endContainer)) return null;
      const startLine = lineElement(range.startContainer); const endLine = lineElement(range.endContainer);
      if (!startLine || !endLine) return null;
      const start = Number(startLine.dataset.start) + within(startLine, range.startContainer, range.startOffset);
      const end = Number(endLine.dataset.start) + within(endLine, range.endContainer, range.endOffset);
      return end > start && lyric.text.slice(start, end).trim() ? {start, end} : null;
    }));
  }
  return <><div className="breadcrumb"><TextLink href={exploreUrl}>Explorar</TextLink><span>/</span><TextLink href={artistUrl(t.artists[0].id)}>{t.artists[0].name}</TextLink><span>/</span><span>{t.title}</span></div>
    <section className="song-hero"><Cover track={t} large/><div><p className="eyebrow">MÚSICA</p><h1>{t.title}</h1><p className="song-meta"><span className="artist-links">{t.artists.map((a, i) => <span key={a.id}>{i > 0 ? ", " : ""}<TextLink href={artistUrl(a.id)}>{a.name}</TextLink></span>)}</span><span>·</span><TextLink className="album-link" href={albumUrl(t)}>{t.album}</TextLink><span>·</span>{duration(t.duration)}</p><dl className="audio-meta"><div><dt>BPM</dt><dd>{t.bpm === null ? 'Não informado' : t.bpm.toFixed(1)}</dd></div><div><dt>Tom</dt><dd>{t.key === null ? 'Não informado' : `${keyNames[t.key]} ${t.mode === 'major' ? 'maior' : 'menor'}`}</dd></div></dl></div></section>
    <details className="metadata-details"><summary>Informações da música e fontes</summary><dl><div><dt>Álbum</dt><dd><TextLink href={albumUrl(t)}>{t.album}</TextLink></dd></div><div><dt>Edição do catálogo</dt><dd>{t.catalogAlbum ?? 'Não informada'}</dd></div><div><dt>ISRC</dt><dd>{t.isrc ?? 'Não informado'}</dd></div><div><dt>Gênero do álbum</dt><dd>{t.genres.join(', ') || 'Não informado'}</dd></div><div><dt>Identificação da música</dt><dd>{t.sourceMatch === 'same_isrc_metadata_consistent' ? 'Identificada pelo ISRC' : t.sourceMatch === 'title_artist_duration_candidate' ? 'Possível correspondência por título, artista e duração' : 'Informação do catálogo'}</dd></div>{t.source && <div><dt>Metadados</dt><dd><TextLink className="inline-icon-link" href={t.source} target="_blank" rel="noreferrer">Consultar fonte<Icon name="external" size={14}/></TextLink></dd></div>}</dl>{t.lyricsReferences.length > 0 && <p>Referências da letra: {t.lyricsReferences.map((url, i) => <TextLink className="inline-icon-link" key={url} href={url} target="_blank" rel="noreferrer">Fonte {i+1}<Icon name="external" size={14}/></TextLink>)}</p>}<p className="caption">BPM e tonalidade vêm das fontes do catálogo e não foram verificados no áudio. A capa é da edição identificada no catálogo.</p></details>
    {!lyric ? <div className="reading-empty"><Empty title="Adicione a letra para explorar esta música" action={<Button variant="primary" onClick={() => setImporting(true)}><Icon name="upload"/>Adicionar letra</Button>}><p>Importe um arquivo .txt ou cole o texto. Depois, selecione os trechos que quiser e guarde em um projeto.</p></Empty></div> : <div className="reading-workspace">
      <section className="reading-panel"><div className="section-heading"><h2>Letra completa</h2><TextAction onClick={() => setImporting(true)}>Editar letra</TextAction></div><p className="caption">Selecione com o mouse, ou clique nos números das linhas. Shift + clique seleciona um intervalo.</p><p className="caption source-label">Origem: {lyric.source && lyric.source !== 'Texto adicionado por você' ? lyric.source : 'Não informada'}</p>
        {params.has('rev') && params.get('rev') !== lyric.revision && <p className="notice">A letra mudou desde que este trecho foi salvo. O texto original continua preservado no projeto.</p>}
        {candidates.length > 0 && <div className="selection-candidate"><span role="status">Nova seleção{candidates.length > 1 ? ` (${candidates.length} trechos)` : ''}: {selectionDescription(lyric.text, candidates)}</span><Button variant="primary" className="small" onMouseDown={event => event.preventDefault()} onClick={() => add(candidates)}><Icon name="plus" size={16}/>Adicionar seleção</Button></div>}
        <div className="lyric-body" ref={body} onMouseUp={capture} onKeyUp={capture} onKeyDown={event => {if (event.key === 'Escape') {window.getSelection()?.removeAllRanges(); setCandidates([]);}}} tabIndex={0} aria-label="Letra da música; selecione texto ou use os botões das linhas">{paragraphs.map(paragraph => <div className="lyric-paragraph" key={paragraph[0].number}>{paragraph.map(line => {const savedIn = savedLineProjects.get(line.number) ?? []; return <div data-saved={savedIn.length > 0 || undefined} title={savedIn.length ? 'Trecho salvo em: ' + savedIn.join(', ') : undefined} className={'lyric-line' + (contextRange && line.start < contextRange.end && line.start + line.text.length > contextRange.start ? ' context-line' : '')} id={'lyric-line-' + line.number} key={line.number}><IconButton variant="plain" className="line-number" aria-label={'Selecionar linha ' + line.number} aria-pressed={selected.some(f => f.start <= line.start && f.end >= line.start + line.text.length)} onClick={e => {setCandidates([]); window.getSelection()?.removeAllRanges(); const i = line.number - 1; if (e.shiftKey && anchorLine.current !== null) {const from = lines[Math.min(i, anchorLine.current)]; const to = lines[Math.max(i, anchorLine.current)]; add([{start: from.start, end: to.start + to.text.length}], true);} else {anchorLine.current = i; const existing = selected.find(f => f.start === line.start && f.end === line.start + line.text.length); if (existing) onDrafts(selected.filter(f => f.id !== existing.id)); else add([{start: line.start, end: line.start + line.text.length}]);}}}>{String(line.number).padStart(2, '0')}</IconButton><span data-line-text="true" data-start={line.start}><HighlightedLine text={line.text} offset={line.start} ranges={selected} saved={saved}/></span></div>;})}</div>)}</div>
      </section>
      <aside className="song-sidebar"><section className="selection-panel"><div className="section-heading"><h2>{selected.length ? `${selected.length} ${selected.length === 1 ? 'trecho selecionado' : 'trechos selecionados'}` : 'Sua seleção'}</h2>{selected.length > 0 && <TextAction onClick={() => onDrafts([])}>Limpar</TextAction>}</div>{selected.length ? <><p className="caption selection-summary" role="status">Total: {selectionDescription(lyric.text, selected)}</p><div className="selected-fragments">{selected.map((f, i) => <article className="selected-fragment" key={f.id}><div><strong>Trecho {i+1} <small>· linhas {fragmentLines(f, lyric).startLine}–{fragmentLines(f, lyric).endLine}</small></strong><IconButton aria-label={'Remover trecho ' + (i+1) + ' da seleção'} onClick={() => onDrafts(selected.filter(x => x.id !== f.id))}><Icon name="close" size={18}/></IconButton></div><blockquote>{f.text}</blockquote></article>)}</div><Button variant="primary" className="wide" onClick={() => setSaving(true)}><Icon name="folder"/>Adicionar a projeto</Button><p className="caption">Escolha um projeto existente ou crie um novo ao salvar.</p></> : <div className="selection-hint"><Icon name="file" size={30}/><p>Uma palavra, um verso ou vários trechos.</p><span className="muted">Selecione os trechos que combinam com a sua ideia.</span></div>}</section><SongProjects workspace={workspace} trackId={id} lyric={lyric}/></aside>
    </div>}
    {importing && <ImportLyric track={t} current={lyric} commit={commit} onClose={() => {setImporting(false); setCandidates([]);}} notify={notify} knownLanguages={Object.values(workspace.lyrics).flatMap(lyricLanguages)}/>}
    {saving && <SaveDialog fragments={selected} workspace={workspace} commit={commit} onClose={() => setSaving(false)} onSaved={message => {setSaving(false); onDrafts([]); notify(message);}}/>}
  </>;
}
