import {FieldInput, FormField} from './FormField.tsx';
import {Button, IconButton, TextAction} from './Controls.tsx';
import {useId, useState} from 'react';
import {keyNames, lyricLanguages} from '../domain/model.ts';
import type {Catalog, Workspace} from '../domain/model.ts';
import {bpmInput, emptyFilters, hasFilters} from '../domain/search.ts';
import type {Filters} from '../domain/search.ts';
import {Icon} from './UI.tsx';
import {FilterSelect} from './FilterSelect.tsx';
import {HelpTooltip} from './HelpTooltip.tsx';
import {filterHelp as help} from '../domain/filterHelp.ts';
export type FilterChangeOptions = {preserveScroll?: boolean};
export function FilterPanel({filters: f, onChange, catalog, workspace}: {filters: Filters; onChange: (f: Filters, options?: FilterChangeOptions) => void; catalog: Catalog; workspace: Workspace}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({...f, [key]: value});
  const setBpm = (key: 'bpmMin' | 'bpmMax', value: string) => {const numeric = bpmInput(value); if (numeric !== null) set(key, numeric);};
  const genres = [...new Set(catalog.tracks.flatMap(t => t.genres))];
  const languages = [...new Set([...Object.values(workspace.lyrics).flatMap(lyricLanguages), ...catalog.tracks.flatMap(t => t.languages ?? []), ...f.language])].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const invalidRange = f.bpmMin && f.bpmMax && Number(f.bpmMin) > Number(f.bpmMax);
  const active = hasFilters(f);
  const selectedGroups = [
    {key: 'key', label: 'Tom', values: f.key.map(value => ({value, label: keyNames[Number(value)] ?? value}))},
    {key: 'genre', label: 'Gênero do álbum', values: f.genre.map(value => ({value, label: value}))},
    {key: 'language', label: 'Idioma', values: f.language.map(value => ({value, label: value}))},
    {key: 'mode', label: 'Modo', values: f.mode.map(value => ({value, label: value === 'major' ? 'Maior' : value === 'minor' ? 'Menor' : value}))},
    {key: 'artist', label: 'Artista', values: f.artist.map(value => ({value, label: value}))},
  ] satisfies {key: 'key' | 'genre' | 'language' | 'mode' | 'artist'; label: string; values: {value: string; label: string}[]}[];
  return <section className="filter-panel" aria-label="Filtros opcionais">
    <div className="filter-caption"><strong>Filtros opcionais</strong><span>Combine os critérios que fizerem sentido para sua pesquisa.</span></div>
    <div className="filter-grid">
      <fieldset className="bpm-field"><legend>BPM</legend><div><FieldInput aria-label="BPM mínimo" type="text" inputMode="decimal" autoComplete="off" placeholder="De" value={f.bpmMin} aria-invalid={!!invalidRange} onChange={e => setBpm('bpmMin', e.target.value)}/><span>–</span><FieldInput aria-label="BPM máximo" type="text" inputMode="decimal" autoComplete="off" placeholder="Até" value={f.bpmMax} aria-invalid={!!invalidRange} onChange={e => setBpm('bpmMax', e.target.value)}/></div></fieldset>
      <FilterSelect label="Tom" value={f.key} onChange={values => set('key', values)} options={keyNames.map((label, i) => ({value: String(i), label}))}/>
      <FilterSelect label="Gênero do álbum" value={f.genre} onChange={values => set('genre', values)} options={genres.map(value => ({value, label: value}))}/>
      <FilterSelect label="Idioma" value={f.language} onChange={values => set('language', values)} options={languages.map(value => ({value, label: value}))}/>
      <Button className="more-filters" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}><Icon name="sliders"/>{expanded ? 'Menos filtros' : 'Mais filtros'}</Button>
    </div>
    {expanded && <div className="filter-grid extra-filters">
      <FilterSelect label="Modo" value={f.mode} onChange={values => set('mode', values)} options={[{value: 'major', label: 'Maior'}, {value: 'minor', label: 'Menor'}]} help={help.mode} multiple={false}/>
      <FilterSelect label="Artista" value={f.artist} onChange={values => set('artist', values)} options={catalog.artists.toSorted((a, b) => a.name.localeCompare(b.name)).map(a => ({value: a.name, label: a.name}))}/>
      <FormField className="filter-text-field" id={id + '-theme'} label="Tema" help={<HelpTooltip label="Tema" text={help.theme}/>}><FieldInput id={id + '-theme'} placeholder="Informado por você" value={f.theme} onChange={e => set('theme', e.target.value)}/></FormField>
      <FormField className="filter-text-field" id={id + '-mood'} label="Clima da letra" help={<HelpTooltip label="Clima da letra" text={help.mood}/>}><FieldInput id={id + '-mood'} placeholder="Informado por você" value={f.mood} onChange={e => set('mood', e.target.value)}/></FormField>
    </div>}
    {selectedGroups.some(group => group.values.length > 0) && <section className="filter-selections" aria-label="Opções selecionadas">
      <p>Opções selecionadas</p>
      <div className="filter-selection-groups">{selectedGroups.filter(group => group.values.length > 0).map(group => <div className="filter-selection-group" role="group" aria-label={group.label} key={group.key}>
        <span className="filter-selection-label">{group.label}</span>
        <div className="filter-selection-chips">{group.values.map(item => <span className="filter-selection-chip" key={item.value}>
          <span>{item.label}</span><IconButton variant="plain" type="button" aria-label={`Remover ${item.label} do filtro ${group.label}`} onClick={() => set(group.key, f[group.key].filter(value => value !== item.value))}><Icon name="close" size={13}/></IconButton>
        </span>)}</div>
      </div>)}</div>
    </section>}
    <div className="filter-bottom"><div className="filter-toggles">
      <label className="check-label"><input type="checkbox" checked={f.hasBpm} onChange={e => onChange({...f, hasBpm: e.target.checked}, {preserveScroll: true})}/>Somente com BPM informado</label>
      <label className="check-label"><input type="checkbox" checked={f.hasTonality} onChange={e => onChange({...f, hasTonality: e.target.checked}, {preserveScroll: true})}/>Somente com tonalidade informada</label>
      <label className="check-label"><input type="checkbox" checked={f.hasLyrics} onChange={e => onChange({...f, hasLyrics: e.target.checked}, {preserveScroll: true})}/>Somente com letra disponível</label>
    </div><TextAction className="filter-clear" tone="accent" disabled={!active} aria-hidden={!active} tabIndex={active ? undefined : -1} onClick={() => onChange({...emptyFilters}, {preserveScroll: true})}>Limpar filtros</TextAction></div>
    {expanded && <p className="caption">Idioma usa as informações da música e da letra. Tema e clima usam as informações adicionadas à letra. Gênero, BPM e tonalidade podem ser consultados nas fontes ou informados por você.</p>}
    {invalidRange && <p className="error-text" role="alert">O BPM mínimo precisa ser menor ou igual ao máximo.</p>}
  </section>;
}
