import {useCallback, useId, useLayoutEffect, useRef, useState} from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';
import type {ClearIndicatorProps} from 'react-select';
import {customLanguage, loadLanguageCatalog, searchLanguages, suggestLanguages} from '../domain/languages.ts';
import type {LanguageOption} from '../domain/languages.ts';
import {normalize} from '../domain/model.ts';
import {Icon} from './UI.tsx';
import {CheckedSelectOption, SelectDropdownIndicator, SelectMultiValueRemove} from './CheckedSelectOption.tsx';

function ClearIndicator(props: ClearIndicatorProps<LanguageOption, true>) {
  return <div {...props.innerProps} className="language-select__clear-indicator" role="button" tabIndex={0} aria-hidden={undefined} aria-label="Limpar idiomas"
    onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); props.clearValue(); document.getElementById(props.selectProps.inputId ?? '')?.focus();}}}><Icon name="close" size={17}/></div>;
}

export function LanguageSelect({value, onChange, saved, disabled}: {value: string[]; onChange: (languages: string[]) => void; saved: string[]; disabled: boolean}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<LanguageOption[]>([]);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  useLayoutEffect(() => {setPortal(container.current?.closest('dialog') ?? null);}, []);
  const getCatalog = useCallback(async () => {
    const languages = await loadLanguageCatalog();
    setCatalog(languages); setLoadError(false);
    return languages;
  }, []);
  const loadOptions = useCallback(async (query: string) => {
    try {const languages = await getCatalog(); return query.trim() ? searchLanguages(languages, query, saved, value) : suggestLanguages(languages, saved, value);}
    catch {setLoadError(true); return searchLanguages([], query, saved, value);}
  }, [saved, value, getCatalog]);
  return <div className="lyric-languages" ref={container}>
    <label htmlFor={id}>Idiomas</label>
    <AsyncCreatableSelect<LanguageOption, true> inputId={id} instanceId={id} isMulti isClearable isSearchable unstyled
      className="language-select" classNamePrefix="language-select" isDisabled={disabled}
      value={value.map(customLanguage)} onChange={items => onChange(items.map(item => item.label))}
      loadOptions={loadOptions} defaultOptions={suggestLanguages(catalog, saved, value)} isLoading={loadingSuggestions}
      onMenuOpen={() => {
        if (catalog.length) return;
        setLoadingSuggestions(true);
        void getCatalog().catch(() => setLoadError(true)).finally(() => setLoadingSuggestions(false));
      }}
      onCreateOption={input => {const language = input.trim(); if (language && !value.some(item => normalize(item) === normalize(language))) onChange([...value, language]);}}
      isValidNewOption={(input, selected, options) => {
        const term = normalize(input);
        const available = options.flatMap(option => 'options' in option ? [...option.options] : [option]);
        return !!term && input.trim().length <= 100 && ![...catalog, ...selected, ...available].some(option => normalize(option.label) === term || normalize(option.englishName ?? '') === term || option.codes.includes(term));
      }}
      formatCreateLabel={input => `Adicionar “${input.trim()}”`} createOptionPosition="last"
      placeholder="Selecione ou pesquise idiomas…" loadingMessage={() => 'Buscando idiomas…'}
      noOptionsMessage={({inputValue}) => inputValue ? 'Nenhum idioma encontrado. Você pode adicionar o nome informado.' : 'Digite o nome ou código de um idioma.'}
      aria-describedby={id + '-help'} closeMenuOnSelect={false} hideSelectedOptions={false} tabSelectsValue={false}
      menuPlacement="auto" menuPosition="fixed" menuPortalTarget={portal ?? undefined} maxMenuHeight={200} menuShouldScrollIntoView={false}
      styles={{menuPortal: base => ({...base, zIndex: 5})}}
      components={{DropdownIndicator: SelectDropdownIndicator, Option: CheckedSelectOption, ClearIndicator, MultiValueRemove: SelectMultiValueRemove, IndicatorSeparator: null}}
      ariaLiveMessages={{
        guidance: () => 'Digite para pesquisar. Use as setas e Enter para selecionar. Backspace remove a última seleção. Escape recolhe as opções.',
        onChange: ({label, action}) => action === 'clear' ? 'Idiomas removidos.' : action === 'remove-value' || action === 'pop-value' || action === 'deselect-option' ? `${label} removido.` : `${label} selecionado.`,
        onFocus: ({label}) => label,
        onFilter: ({resultsMessage}) => resultsMessage,
      }}
      screenReaderStatus={({count}) => `${count} opções exibidas. Refine a busca para encontrar outros idiomas.`}/>
    <p id={id + '-help'} className="language-select-help">Sugestões priorizam os idiomas do seu acervo. Busque outros por nome ou código, ou adicione um idioma. Sem seleção significa não informado.</p>
    {loadError && <p className="error-text" role="status">Não foi possível carregar o catálogo. Você ainda pode digitar e adicionar qualquer idioma.</p>}
  </div>;
}
