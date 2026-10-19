import {FormField} from './FormField.tsx';
import {useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import AsyncCreatableSelect from 'react-select/async-creatable';
import {allLanguageOptions, customLanguage, loadLanguageCatalog, searchLanguages, suggestLanguages} from '../domain/languages.ts';
import type {LanguageOption} from '../domain/languages.ts';
import {normalize} from '../domain/model.ts';
import {CheckedSelectOption, SelectClearIndicator, SelectDropdownIndicator, SelectMultiValueRemove} from './CheckedSelectOption.tsx';
import {TextAction} from './Controls.tsx';
import {CreateOptionLabel} from './CreateOptionLabel.tsx';
import './languageSelect.css';

export function LanguageSelect({value, onChange, saved, disabled, showHelp = true}: {value: string[]; onChange: (languages: string[]) => void; saved: string[]; disabled: boolean; showHelp?: boolean}) {
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<LanguageOption[]>([]);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [browseAll, setBrowseAll] = useState(false); const [limit, setLimit] = useState(60); const [menuOpen, setMenuOpen] = useState(false);
  const [input, setInput] = useState('');
  useLayoutEffect(() => {setPortal(container.current?.closest('dialog') ?? null);}, []);
  const getCatalog = useCallback(async () => {
    const languages = await loadLanguageCatalog();
    setCatalog(languages); setLoadError(false);
    return languages;
  }, []);
  useEffect(() => {void getCatalog().catch(() => setLoadError(true));}, [getCatalog]);
  const loadOptions = useCallback(async (query: string) => {
    try {const languages = await getCatalog(); return query.trim() ? searchLanguages(languages, query, saved, value) : suggestLanguages(languages, saved, value);}
    catch {setLoadError(true); return searchLanguages([], query, saved, value);}
  }, [saved, value, getCatalog]);
  const defaults = browseAll ? allLanguageOptions(catalog, saved, value).slice(0, limit) : suggestLanguages(catalog, saved, value);
  return <FormField id={id} label="Idiomas" help={<TextAction className="language-browse-action" disabled={disabled} aria-label={browseAll ? 'Ver sugestões de idiomas' : 'Ver todos os idiomas'} onClick={() => {setBrowseAll(!browseAll); setInput(''); setLimit(60); setMenuOpen(true); document.getElementById(id)?.focus();}}>{browseAll ? 'Sugestões' : 'Todos os idiomas'}</TextAction>} className="lyric-languages" ref={container}>
    <AsyncCreatableSelect<LanguageOption, true> inputId={id} instanceId={id} aria-label="Idiomas" isMulti isClearable isSearchable unstyled
      className="language-select" classNamePrefix="language-select" isDisabled={disabled}
      inputValue={input} onInputChange={setInput}
      value={value.map(customLanguage)} onChange={items => onChange(items.map(item => item.label))}
      loadOptions={loadOptions} defaultOptions={defaults} isLoading={loadingSuggestions} menuIsOpen={menuOpen}
      onMenuClose={() => setMenuOpen(false)} onMenuScrollToBottom={() => {if (browseAll) setLimit(n => n + 60);}}
      onMenuOpen={() => {
        setMenuOpen(true);
        if (catalog.length) return;
        setLoadingSuggestions(true);
        void getCatalog().catch(() => setLoadError(true)).finally(() => setLoadingSuggestions(false));
      }}
      onCreateOption={input => {const language = input.trim(); if (language && ![...allLanguageOptions(catalog, saved, value)].some(item => normalize(item.label) === normalize(language) || normalize(item.englishName ?? '') === normalize(language) || item.codes.includes(normalize(language)))) onChange([...value, language]); setInput('');}}
      isValidNewOption={(input, selected, options) => {
        const term = normalize(input);
        const available = options.flatMap(option => 'options' in option ? [...option.options] : [option]);
        return !!term && input.trim().length <= 100 && ![...catalog, ...selected, ...available].some(option => normalize(option.label) === term || normalize(option.englishName ?? '') === term || option.codes.includes(term));
      }}
      formatCreateLabel={input => `Adicionar “${input.trim()}” como novo idioma`} createOptionPosition="first" allowCreateWhileLoading
      formatOptionLabel={(option, context) => context.context === 'menu' && '__isNew__' in option && option.__isNew__ ? <CreateOptionLabel>{option.label}</CreateOptionLabel> : option.label}
      placeholder="Selecione ou pesquise idiomas…" loadingMessage={() => 'Buscando idiomas…'}
      noOptionsMessage={({inputValue}) => inputValue ? 'Nenhum idioma encontrado. Você pode adicionar o nome informado.' : 'Digite o nome ou código de um idioma.'}
      aria-describedby={showHelp ? id + '-help' : undefined} closeMenuOnSelect={false} hideSelectedOptions={false} tabSelectsValue={false}
      menuPlacement="auto" menuPosition="fixed" menuPortalTarget={portal ?? undefined} maxMenuHeight={200} menuShouldScrollIntoView={false}
      styles={{menuPortal: base => ({...base, zIndex: 5})}}
      components={{DropdownIndicator: SelectDropdownIndicator, Option: CheckedSelectOption, ClearIndicator: SelectClearIndicator, MultiValueRemove: SelectMultiValueRemove, IndicatorSeparator: null}}
      ariaLiveMessages={{
        guidance: () => 'Digite para pesquisar. Use as setas e Enter para selecionar. Backspace remove a última seleção. Escape recolhe as opções.',
        onChange: ({label, action}) => action === 'clear' ? 'Idiomas removidos.' : action === 'remove-value' || action === 'pop-value' || action === 'deselect-option' ? `${label} removido.` : `${label} selecionado.`,
        onFocus: ({label}) => label,
        onFilter: ({resultsMessage}) => resultsMessage,
      }}
      screenReaderStatus={({count}) => `${count} opções exibidas. Refine a busca para encontrar outros idiomas.`}/>
    {showHelp && <p id={id + '-help'} className="language-select-help">Sugestões priorizam os idiomas do seu acervo. Busque outros por nome ou código, ou adicione um idioma. Sem seleção significa não informado.</p>}
    {loadError && <p className="error-text" role="status">Não foi possível carregar o catálogo. Você ainda pode digitar e adicionar qualquer idioma.</p>}
  </FormField>;
}
