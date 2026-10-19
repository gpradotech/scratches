import {FormField} from './FormField.tsx';
import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';
import {normalize} from '../domain/model.ts';
import {isManagedAlbum, mergeMetadataOptions} from '../domain/metadata.ts';
import type {MetadataKind, MetadataOption} from '../domain/metadata.ts';
import {CheckedSelectOption, SelectClearIndicator, SelectDropdownIndicator, SelectMultiValueRemove} from './CheckedSelectOption.tsx';
import {HelpTooltip} from './HelpTooltip.tsx';
import {ArtistAvatar} from './ArtistAvatar.tsx';
import {Artwork} from './Artwork.tsx';
import {Icon} from './UI.tsx';
import {CreateOptionLabel} from './CreateOptionLabel.tsx';
import './metadataSelect.css';

function MetadataOptionLabel({option, kind}: {option: MetadataOption; kind: MetadataKind}) {
  const creating = '__isNew__' in option && option.__isNew__;
  if (creating) return <CreateOptionLabel>{option.label}</CreateOptionLabel>;
  const cover = option.album?.cover;
  return <span className={'metadata-option' + (creating ? ' metadata-option--create' : '')}>
    {creating ? <Icon name="plus" size={20}/> : kind === 'artist' ? <ArtistAvatar name={option.label} picture={option.artist?.picture}/>
      : kind === 'album' ? <span className="metadata-option-cover" aria-hidden="true"><Artwork source={cover} alt="" fallback={<Icon name="file" size={20}/>} /></span> : null}
    <span className="metadata-option-copy"><span>{option.label}</span>{kind === 'album' && option.description && <small>{option.description}</small>}</span>
  </span>;
}

export function MetadataSelect({label, kind, value, options, onChange, onCreate, multiple = false, disabled = false}: {
  label: string; kind: MetadataKind; value: MetadataOption[]; options: MetadataOption[];
  onChange: (options: MetadataOption[]) => void; onCreate: (name: string) => MetadataOption; multiple?: boolean; disabled?: boolean;
}) {
  const id = useId(); const container = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [input, setInput] = useState(''); const [defaults, setDefaults] = useState<MetadataOption[]>([]);
  const [failed, setFailed] = useState(false); const [loading, setLoading] = useState(false);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null); const active = useRef<AbortController | null>(null);
  const lastOptions = useRef<MetadataOption[]>([]); const loadedGenres = useRef(false);
  useLayoutEffect(() => {setPortal(container.current?.closest('dialog') ?? null);}, []);
  useEffect(() => () => {if (pending.current) clearTimeout(pending.current); active.current?.abort();}, []);
  const available = mergeMetadataOptions([...options, ...value], defaults, kind).filter(o => kind !== 'album' || o.album && isManagedAlbum(o.album));
  const matches = useCallback((items: MetadataOption[], query: string) => items.filter(o => normalize(o.label + ' ' + (kind === 'artist' || kind === 'album' ? o.description ?? '' : '')).includes(normalize(query))).slice(0, 30), [kind]);
  const fetchOptions = useCallback(async (query: string, signal: AbortSignal) => {
    const response = await fetch('/api/music/suggest?' + new URLSearchParams({kind, q: query}), {signal});
    if (!response.ok) throw new Error('Fonte indisponível.');
    return (await response.json()).items as MetadataOption[];
  }, [kind]);
  const maxLength = kind === 'album' || kind === 'label' ? 300 : 100;
  const newLabel = (name: string) => `Adicionar “${name.trim()}” como ${kind === 'artist' ? 'novo artista' : kind === 'album' ? 'novo álbum' : kind === 'genre' ? 'novo gênero' : 'nova gravadora'}`;
  function commitInput(name: string, createNew = false) {
    const label = name.trim(); if (!label || label.length > maxLength) return;
    const known = createNew && (kind === 'artist' || kind === 'album') ? undefined : [...available, ...lastOptions.current].find(o => normalize(o.label) === normalize(label));
    const option = known ?? onCreate(label);
    if (option.disabled) return;
    if (multiple && value.some(o => o.value === option.value || kind !== 'artist' && normalize(o.label) === normalize(option.label))) {setInput(''); return;}
    onChange(multiple ? [...value, option] : [option]); setInput('');
  }
  return <FormField id={id} label={label} help={kind === 'album' && <HelpTooltip label="Álbum" text="Escolha um álbum criado por você ou crie um novo. O álbum original de uma música encontrada nas fontes pode ser mantido, mas não é oferecido para adicionar outras músicas."/>} className="metadata-select-field" ref={container}>
    <AsyncCreatableSelect<MetadataOption, boolean> inputId={id} instanceId={id} aria-label={label} unstyled
      className="language-select metadata-select" classNamePrefix="language-select" isMulti={multiple} isDisabled={disabled} isClearable
      value={multiple ? value : value[0] ?? null} inputValue={input}
      isOptionDisabled={option => !!option.disabled}
      onInputChange={(next, meta) => {if (meta.action === 'input-change') setInput(next);}}
      onChange={items => {onChange(!items ? [] : 'value' in items ? [items] : [...items]); setInput('');}}
      onCreateOption={name => commitInput(name, true)}
      onBlur={() => {if (input.trim()) commitInput(input);}}
      onKeyDown={event => {if (!event.nativeEvent.isComposing && multiple && [',', ';'].includes(event.key) && input.trim()) {event.preventDefault(); commitInput(input);}}}
      isValidNewOption={(name, selected, displayed) => {
        const term = normalize(name);
        const known = [...available, ...lastOptions.current, ...displayed.flatMap(item => 'options' in item ? [...item.options] : [item])];
        return !!term && name.trim().length <= maxLength && !(multiple && kind !== 'artist' && selected.some(o => normalize(o.label) === term)) &&
          ((kind === 'artist' || kind === 'album') || !known.some(o => normalize(o.label) === term));
      }}
      formatCreateLabel={newLabel} createOptionPosition="first" allowCreateWhileLoading={kind === 'artist' || kind === 'album'}
      formatOptionLabel={(option, context) => context.context === 'menu' ? <MetadataOptionLabel option={option} kind={kind}/> : option.label}
      defaultOptions={available.slice(0, 30)} isLoading={loading}
      loadOptions={(query, callback) => {
        if (pending.current) clearTimeout(pending.current); active.current?.abort();
        const local = matches(available, query);
        if (kind === 'album' || kind === 'genre' && loadedGenres.current || query.trim().length < 2) {callback(local); return;}
        pending.current = setTimeout(() => {
          const controller = new AbortController(); active.current = controller;
          void fetchOptions(query, controller.signal).then(remote => {if (controller.signal.aborted) return; setFailed(false); const items = mergeMetadataOptions(local, remote, kind); lastOptions.current = items; callback(items);})
            .catch(() => {if (!controller.signal.aborted) {setFailed(true); callback(local);}});
        }, 350);
      }}
      onMenuOpen={() => {
        if (kind !== 'genre' || loadedGenres.current || loading) return;
        const controller = new AbortController(); active.current = controller; setLoading(true);
        void fetchOptions('', controller.signal).then(items => {if (controller.signal.aborted) return; setDefaults(items); lastOptions.current = items; loadedGenres.current = true; setFailed(false);})
          .catch(() => {if (!controller.signal.aborted) setFailed(true);}).finally(() => setLoading(false));
      }}
      placeholder={multiple ? 'Pesquise ou adicione…' : 'Pesquise ou adicione…'} loadingMessage={() => 'Buscando opções…'}
      noOptionsMessage={({inputValue}) => inputValue ? 'Nenhuma opção encontrada. Você pode adicionar esse nome.' : 'Digite para pesquisar ou adicionar.'}
      closeMenuOnSelect={!multiple} hideSelectedOptions={false} tabSelectsValue={false}
      menuPlacement="auto" menuPosition="fixed" menuPortalTarget={portal ?? undefined} maxMenuHeight={220} menuShouldScrollIntoView={false}
      styles={{menuPortal: base => ({...base, zIndex: 50})}}
      components={{DropdownIndicator: SelectDropdownIndicator, ClearIndicator: SelectClearIndicator, Option: CheckedSelectOption, MultiValueRemove: SelectMultiValueRemove, IndicatorSeparator: null}}
      ariaLiveMessages={{guidance: () => 'Digite para pesquisar. Use as setas e Enter para escolher ou adicionar um nome novo. Backspace remove uma seleção.',
        onChange: ({label: name, action}) => action === 'remove-value' || action === 'pop-value' ? `${name} removido.` : `${name} selecionado.`}}
      screenReaderStatus={({count}) => `${count} opções disponíveis.`}/>
    {failed && <span className="metadata-offline" role="status">Fonte indisponível. Use as opções locais ou adicione um nome novo.</span>}
  </FormField>;
}
