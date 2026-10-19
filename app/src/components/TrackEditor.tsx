import {TextField} from './FormField.tsx';
import {useEffect, useMemo, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import type {AlbumMetadata, Artist, Catalog, MetadataField, ReleaseType, Track, Workspace} from '../domain/model.ts';
import {duration, keyNames, metadataFields, normalize, validateTrack} from '../domain/model.ts';
import {completeMetadata, isImportedField, isImportedTrack, markImportedMetadata, metadataOrigin} from '../domain/metadataOrigins.ts';
import {albumTracks, applyFoundMetadata, newTrack, saveTrack} from '../domain/library.ts';
import type {MusicCandidate, MusicProvider} from '../../server/music.ts';
import type {Commit} from './ProjectDialogs.tsx';
import {Button, TextAction, TextLink} from './Controls.tsx';
import {Dialog, Icon} from './UI.tsx';
import {Artwork} from './Artwork.tsx';
import {MetadataSelect} from './MetadataSelect.tsx';
import {CoverInput} from './CoverInput.tsx';
import {albumForTrack, collectMetadata, createMetadataOption, metadataOptions} from '../domain/metadata.ts';
import {durationValue, trackBpmInput} from '../domain/trackFields.ts';
import {DurationField} from './DurationField.tsx';
import {SelectField} from './SelectField.tsx';
import {LanguageSelect} from './LanguageSelect.tsx';
import './trackEditor.css';

type Stage = 'lookup' | 'edit';
const providerName = (provider: MusicProvider) => provider === 'deezer' ? 'Deezer' : 'Apple (iTunes)';
const trackValues = (track: Track) => ({title: track.title,
  duration: track.duration ? durationValue(track.duration) : '',
  bpm: track.bpm === null ? '' : String(Math.round(track.bpm * 100) / 100), key: track.key === null ? '' : String(track.key), mode: track.mode ?? '',
  releaseDate: track.releaseDate ?? '', releaseType: track.releaseType ?? '', isrc: track.isrc ?? '', label: track.label ?? '', cover: track.cover ?? '', source: track.source ?? '',
  explicit: track.explicit === undefined || track.explicit === null ? '' : track.explicit ? 'yes' : 'no'});
type FormValues = ReturnType<typeof trackValues>;
async function request<T>(address: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(address, {signal, cache: 'no-store'});
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível consultar a fonte.');
  return body;
}
export function TrackEditor({existing, catalog, workspace, commit, onClose, onSaved}: {existing?: Track; catalog: Catalog; workspace: Workspace; commit: Commit; onClose: () => void; onSaved: (track: Track) => void}) {
  const [stage, setStage] = useState<Stage>(existing ? 'edit' : 'lookup');
  const [draft, setDraft] = useState(existing ?? newTrack);
  const imported = isImportedTrack(draft);
  const [form, setForm] = useState(() => trackValues(draft));
  const metadata = useMemo(() => collectMetadata(catalog, workspace), [catalog, workspace]);
  const [artists, setArtists] = useState<Artist[]>(() => draft.artists.map(a => metadata.artists.find(item => item.id === a.id) ?? {...a, picture: null}));
  const [genres, setGenres] = useState(draft.genres);
  const [album, setAlbum] = useState<AlbumMetadata | null>(() => albumForTrack(draft));
  const [languages, setLanguages] = useState(draft.languages ?? []);
  const change = (key: keyof FormValues, value: string) => setForm(current => ({...current, [key]: value}));
  const [query, setQuery] = useState(existing?.title ?? '');
  const [artist, setArtist] = useState(existing?.artists[0]?.name ?? '');
  const [items, setItems] = useState<MusicCandidate[]>();
  const [provider, setProvider] = useState<MusicProvider>();
  const [notice, setNotice] = useState(''); const [error, setError] = useState('');
  const [busy, setBusy] = useState(false); const [saving, setSaving] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  function manual() {
    active.current?.abort(); setBusy(false); setError(''); setNotice('');
    setForm(current => ({...current, title: current.title || query.trim()}));
    if (!artists.length && artist.trim()) setArtists([metadata.artists.find(a => normalize(a.name) === normalize(artist)) ?? createMetadataOption('artist', artist).artist!]);
    setStage('edit');
  }
  async function search(source?: MusicProvider) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError(''); setItems(undefined); setNotice('');
    const params = new URLSearchParams({q: [query.trim(), artist.trim()].filter(Boolean).join(' ')});
    if (source) params.set('provider', source);
    try {const result = await request<{items: MusicCandidate[]; provider: MusicProvider; notice: string}>('/api/music/search?' + params, controller.signal); if (controller.signal.aborted) return; setItems(result.items); setProvider(result.provider); setNotice(result.notice);}
    catch (e) {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível pesquisar.');}
    finally {if (active.current === controller) setBusy(false);}
  }
  async function choose(item: MusicCandidate) {
    active.current?.abort(); const controller = new AbortController(); active.current = controller;
    setBusy(true); setError('');
    try {
      const result = await request<{track: Track; artists?: Artist[]; notice: string}>('/api/music/metadata?' + new URLSearchParams({provider: item.provider, id: item.id}), controller.signal);
      if (controller.signal.aborted) return;
      validateTrack(result.track);
      const next = existing ? applyFoundMetadata(draft, result.track) : markImportedMetadata({...result.track, lyricsReferences: draft.lyricsReferences});
      setDraft(next); setForm(trackValues(next)); setLanguages(next.languages ?? []); setArtists(next.artists.map(a => {
        const local = metadata.artists.find(item => item.id === a.id); const found = result.artists?.find(item => item.id === a.id);
        const savedLocally = local?.picture?.startsWith('data:image/') || local?.picture?.startsWith('/catalogo/');
        return {...a, picture: savedLocally ? local!.picture : found?.picture ?? local?.picture ?? null};
      })); setGenres(next.genres); setAlbum(albumForTrack(next));
      setNotice(result.notice); setStage('edit');
    } catch (e) {if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Não foi possível obter os dados.');}
    finally {if (active.current === controller) setBusy(false);}
  }
  async function save(track: Track) {
    setSaving(true); setError('');
    try {await commit(current => saveTrack(current, catalog, track, existing?.id, artists)); onSaved(track);}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível salvar.');}
    finally {setSaving(false);}
  }
  return <Dialog title={existing ? imported ? 'Complementar metadados' : 'Editar metadados' : 'Adicionar música'} className="track-editor" onClose={onClose} closeDisabled={saving}>
    {stage === 'lookup' ? <>
      <p className="muted">Encontre a música para preencher os dados. Confira o artista e o álbum antes de escolher uma versão.</p>
      <form onSubmit={e => {e.preventDefault(); void search();}}>
        <div className="track-form-grid"><TextField label="Título ou nome da música" autoFocus maxLength={300} value={query} onChange={e => setQuery(e.target.value)} placeholder="Ex.: Heresia"/>
          <TextField label={<>Artista para a busca <span className="optional-label">(opcional)</span></>} maxLength={100} value={artist} onChange={e => setArtist(e.target.value)} placeholder="Ex.: Djonga"/></div>
        <div className="track-lookup-actions"><Button type="submit" variant="primary" disabled={busy || ![query, artist].some(v => v.trim())}><Icon name="search"/>{busy ? 'Consultando…' : 'Buscar metadados'}</Button><TextAction onClick={manual}>Preencher manualmente</TextAction></div>
      </form>
      <p className="caption">A busca consulta primeiro o Deezer e tenta a Apple (iTunes) se necessário. Somente o título e o artista informados são enviados.</p>
      {notice && <p className="notice" role="status">{notice}</p>}
      {busy && <p role="status" className="metadata-loading"><span className="spinner"/>Consultando a fonte de metadados…</p>}
      {items && <section className="metadata-results" aria-label="Músicas encontradas"><h3>{items.length ? `Resultados de ${providerName(provider!)}` : 'Nenhuma música encontrada'}</h3>
        {items.length ? <p className="caption">Escolha a gravação correspondente. Você poderá complementar os dados ausentes em seguida.</p> : <p className="muted">Tente outro título ou artista, outra fonte, ou preencha os dados manualmente.</p>}
        {items.map(item => <Button className="metadata-result" key={item.provider + item.id} disabled={busy} onClick={() => void choose(item)}>
          <Artwork source={item.cover} alt="" fallback={<span className="metadata-result-cover"><Icon name="file"/></span>}/>
          <span className="metadata-result-info"><strong>{item.title}</strong><span>{item.artists.join(', ')}</span><small>{item.album || 'Álbum não informado'} · {duration(item.duration)}</small></span><span className="metadata-result-choice">Usar dados<Icon name="arrow" size={16}/></span>
        </Button>)}
      </section>}
      {(items || error) && <div className="track-lookup-actions"><Button disabled={busy} onClick={() => void search(provider === 'itunes' ? 'deezer' : 'itunes')}>Tentar {provider === 'itunes' ? 'Deezer' : 'Apple (iTunes)'}</Button><TextAction onClick={manual}>Continuar manualmente</TextAction></div>}
    </> : <>
      <div className="metadata-review-heading"><p className="muted">{imported ? 'Os dados importados estão protegidos. Preencha os campos ausentes; seus complementos serão identificados como registros manuais.' : 'Confira os dados e corrija o que precisar. Título e artista são obrigatórios; os demais campos podem ficar vazios.'}</p>{(!existing || !imported) && <TextAction disabled={saving} onClick={() => {setStage('lookup'); setError('');}}><Icon name="arrow-left" size={16}/>{existing ? 'Buscar metadados nas fontes' : 'Voltar à busca'}</TextAction>}</div>
      {notice && <p className="notice" role="status">{notice}</p>}
      <TrackFields track={draft} form={form} change={change} languages={languages} onLanguages={setLanguages} disabled={saving} onSave={save} onCancel={existing ? onClose : () => {setStage('lookup'); setError('');}} cancelLabel={existing ? 'Cancelar' : 'Voltar'} metadata={metadata} albumOptions={metadataOptions('album', metadata).map(option => {const fullSingle = albumTracks(catalog, option.value, existing?.id).some(item => item.releaseType === 'single'); return {...option, disabled: fullSingle, description: fullSingle ? 'Single completo · escolha outro lançamento' : option.description};})} artists={artists} onArtists={setArtists} genres={genres} onGenres={setGenres} album={album} onAlbum={value => {setAlbum(value); if (value && !imported) setForm(current => ({...current, cover: current.cover || value.cover || '', releaseDate: current.releaseDate || value.releaseDate || '', source: current.source || value.source || '', releaseType: value.releaseType ?? current.releaseType}));}}/>
    </>}
    {error && <p role="alert" className="error-text">{error}</p>}
  </Dialog>;
}
function TrackFields({track, form, change, languages, onLanguages, disabled, onSave, onCancel, cancelLabel, metadata, albumOptions, artists, onArtists, genres, onGenres, album, onAlbum}: {
  track: Track; form: FormValues; change: (key: keyof FormValues, value: string) => void; languages: string[]; onLanguages: (languages: string[]) => void;
  disabled: boolean; onSave: (track: Track) => Promise<void>; onCancel: () => void; cancelLabel: string;
  metadata: ReturnType<typeof collectMetadata>; albumOptions: ReturnType<typeof metadataOptions>; artists: Artist[]; onArtists: (artists: Artist[]) => void;
  genres: string[]; onGenres: (genres: string[]) => void; album: AlbumMetadata | null; onAlbum: (album: AlbumMetadata | null) => void;
}) {
  const [error, setError] = useState(''); const [uploading, setUploading] = useState(false);
  const locked = disabled || uploading;
  const imported = isImportedTrack(track);
  const fieldDisabled = (name: MetadataField) => disabled || isImportedField(track, name);
  const field = (name: MetadataField, control: ReactNode) => <div className={'track-metadata-field' + (name === 'cover' ? ' track-metadata-field--wide' : '')}>
    {control}{imported && <span className="metadata-origin">{isImportedField(track, name) ? `Importado · ${track.links?.[0]?.label ?? 'fonte do catálogo'}` : metadataOrigin(track, name) === 'manual' ? 'Registro manual' : 'Preenchimento manual'}</span>}
  </div>;
  function build() {
    const duration = form.duration;
    if (duration && !/^\d{2}:[0-5]\d:[0-5]\d$/.test(duration)) throw new Error('Confira a duração no formato HH:MM:SS.');
    if (form.bpm && (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(form.bpm) || trackBpmInput(form.bpm) === null)) throw new Error('Informe um BPM de até 400, com no máximo duas casas decimais.');
    const [hours = 0, minutes = 0, seconds = 0] = duration.split(':').map(Number);
    const next: Track = {...track, title: form.title.trim(), artists: artists.map(({id, name}) => ({id, name})),
      album: album?.title ?? '', albumId: album?.id ?? null, duration: form.duration ? hours * 3600 + minutes * 60 + seconds : 0, bpm: form.bpm ? Number(form.bpm.replace(',', '.')) : null,
      key: form.key ? Number(form.key) : null, mode: form.mode || null, genres, languages,
      releaseDate: form.releaseDate || null, releaseType: form.releaseType as ReleaseType || null, isrc: form.isrc.replace(/[\s-]/g, '').toUpperCase() || null,
      label: form.label.trim() || null, cover: form.cover.trim() || null, source: form.source.trim() || null,
      explicit: form.explicit ? form.explicit === 'yes' : null, catalogAlbum: album?.title ?? null};
    if (imported) {
      Object.assign(next, Object.fromEntries(metadataFields.filter(name => isImportedField(track, name)).map(name => [name, track[name]])));
      if (isImportedField(track, 'album')) {next.albumId = track.albumId; next.catalogAlbum = track.catalogAlbum;}
      if (!isImportedField(track, 'genres') && genres.length) next.genreScope = 'track';
    }
    const completed = completeMetadata(track, next);
    validateTrack(completed); return completed;
  }
  return <form onSubmit={e => {e.preventDefault(); if (locked) return; try {const next = build(); setError(''); void onSave(next);} catch (e) {setError(e instanceof Error ? e.message : 'Confira os campos.');}}}>
    <fieldset disabled={disabled} className="track-fields"><div className="track-form-grid">
      {field('title', <TextField label="Título da música" disabled={fieldDisabled('title')} placeholder="Ex.: Heresia" required maxLength={300} value={form.title} onChange={e => change('title', e.target.value)}/>)}
      {field('artists', <MetadataSelect label="Artistas" kind="artist" multiple disabled={fieldDisabled('artists')} value={artists.map(artist => ({value: artist.id, label: artist.name, artist}))} options={metadataOptions('artist', metadata)} onCreate={name => createMetadataOption('artist', name)} onChange={items => onArtists(items.map(o => o.artist!))}/>)}
      {field('album', <MetadataSelect label="Álbum" kind="album" disabled={fieldDisabled('album')} value={album ? [{value: album.id, label: album.title, album}] : []} options={albumOptions} onCreate={name => createMetadataOption('album', name, artists)} onChange={items => onAlbum(items[0]?.album ?? null)}/>)}
      {field('duration', <DurationField disabled={fieldDisabled('duration')} value={form.duration} onChange={value => change('duration', value)}/>)}
      {field('bpm', <TextField label="BPM" disabled={fieldDisabled('bpm')} inputMode="decimal" placeholder="Não informado" maxLength={6} value={form.bpm} onChange={e => {if (trackBpmInput(e.target.value) !== null) change('bpm', e.target.value);}}/>)}
      {field('key', <SelectField placeholder="Não informado" label="Tom" multiple={false} disabled={fieldDisabled('key')} value={form.key ? [form.key] : []} onChange={values => change('key', values[0] ?? '')} options={[...keyNames.map((label, index) => ({value: String(index), label}))]}/>)}
      {field('mode', <SelectField placeholder="Não informado" label="Modo" multiple={false} disabled={fieldDisabled('mode')} value={form.mode ? [form.mode] : []} onChange={values => change('mode', values[0] ?? '')} options={[{value: 'major', label: 'Maior'}, {value: 'minor', label: 'Menor'}]}/>)}
      {field('genres', <MetadataSelect label="Gêneros" kind="genre" multiple disabled={fieldDisabled('genres')} value={genres.map(label => ({value: normalize(label), label}))} options={metadataOptions('genre', metadata)} onCreate={name => createMetadataOption('genre', name)} onChange={items => onGenres(items.map(o => o.label))}/>)}
      {field('languages', <LanguageSelect value={languages} onChange={onLanguages} saved={metadata.languages} disabled={fieldDisabled('languages')} showHelp={false}/>)}
      {field('releaseDate', <TextField label="Data de lançamento" disabled={fieldDisabled('releaseDate')} type="date" value={form.releaseDate} onChange={e => change('releaseDate', e.target.value)}/>)}
      {field('releaseType', <SelectField placeholder="Não informado" label="Tipo de lançamento" multiple={false} disabled={fieldDisabled('releaseType')} value={form.releaseType ? [form.releaseType] : []} onChange={values => change('releaseType', values[0] ?? '')} options={[{value: 'album', label: 'Álbum'}, {value: 'single', label: 'Single'}, {value: 'ep', label: 'EP'}, {value: 'compilation', label: 'Compilação'}]}/>)}
      {field('explicit', <SelectField placeholder="Não informado" label="Conteúdo explícito" multiple={false} disabled={fieldDisabled('explicit')} value={form.explicit ? [form.explicit] : []} onChange={values => change('explicit', values[0] ?? '')} options={[{value: 'yes', label: 'Sim'}, {value: 'no', label: 'Não'}]}/>)}
      {field('isrc', <TextField label="ISRC" disabled={fieldDisabled('isrc')} maxLength={20} value={form.isrc} onChange={e => change('isrc', e.target.value)} placeholder="Código da gravação, se conhecido"/>)}
      {field('label', <MetadataSelect label="Gravadora" kind="label" disabled={fieldDisabled('label')} value={form.label ? [{value: normalize(form.label), label: form.label}] : []} options={metadataOptions('label', metadata)} onCreate={name => createMetadataOption('label', name)} onChange={items => change('label', items[0]?.label ?? '')}/>)}
      {field('source', <TextField label="Fonte dos metadados" disabled={fieldDisabled('source')} maxLength={2000} value={form.source} onChange={e => change('source', e.target.value)} placeholder="https://…"/>)}
      {field('cover', <CoverInput value={form.cover} onChange={value => change('cover', value)} disabled={fieldDisabled('cover')} onBusy={setUploading}/>)}
    </div></fieldset>
    <p className="caption">Artistas, álbuns, gêneros, idiomas e gravadoras ficam disponíveis para reutilização ao salvar a música.</p>
    {track.source && <p className="caption">Dados consultados em <TextLink href={track.source} target="_blank" rel="noreferrer">{track.links?.[0]?.label ?? 'fonte informada'}<Icon name="external" size={13}/></TextLink>.</p>}
    {error && <p role="alert" className="error-text">{error}</p>}
    <div className="dialog-actions"><Button disabled={locked} onClick={onCancel}>{cancelLabel === 'Voltar' && <Icon name="arrow-left" size={16}/>} {cancelLabel}</Button><Button disabled={locked} variant="primary" type="submit">{uploading ? 'Preparando imagem…' : disabled ? 'Salvando…' : 'Salvar música'}</Button></div>
  </form>;
}
