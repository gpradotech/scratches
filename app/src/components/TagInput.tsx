import {useId} from 'react';
import Select from 'react-select';
import {splitTags} from '../domain/tags.ts';
import type {TagInputState, TagKind} from '../domain/tags.ts';
import {SelectMultiValueRemove} from './CheckedSelectOption.tsx';
import {HelpTooltip} from './HelpTooltip.tsx';
import './tagInput.css';

interface TagOption {value: string; label: string}
export function TagInput({label, help, kind, value, onChange, disabled}: {
  label: string; help: string; kind: TagKind; value: TagInputState; onChange: (value: TagInputState) => void; disabled: boolean;
}) {
  const id = useId();
  const {tags, draft, error} = value;
  const apply = (input: string, finish = false) => {
    onChange(splitTags(tags, input, kind, finish));
  };
  return <div className="tag-input-field">
    <div className="filter-label-help"><label htmlFor={id}>{label}</label><HelpTooltip label={label} text={help}/></div>
    <Select<TagOption, true> inputId={id} instanceId={id} aria-label={label}
      aria-describedby={id + '-help' + (error ? ' ' + id + '-error' : '')} aria-invalid={!!error}
      className="language-select tag-input" classNamePrefix="language-select" unstyled isMulti isClearable={false} isDisabled={disabled}
      menuIsOpen={false} openMenuOnClick={false} openMenuOnFocus={false} tabSelectsValue={false}
      value={tags.map(tag => ({value: tag, label: tag}))} inputValue={draft}
      onInputChange={(input, meta) => {if (meta.action === 'input-change') apply(input);}}
      onChange={items => onChange(splitTags(items.map(item => item.label), draft, kind))}
      onBlur={() => apply(draft, true)}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === ',' || event.key === 'Enter' || event.key === 'Tab' && draft.trim()) {
          if (event.key !== 'Tab') event.preventDefault();
          apply(draft, true);
        }
      }}
      placeholder={kind === 'themes' ? 'Digite um tema…' : 'Digite um clima…'}
      components={{DropdownIndicator: null, IndicatorSeparator: null, MultiValueRemove: SelectMultiValueRemove}}
      ariaLiveMessages={{
        guidance: () => 'Digite e use vírgula ou Enter para adicionar. Backspace remove o último item.',
        onChange: ({label, action}) => action === 'remove-value' || action === 'pop-value' ? `${label} removido.` : `${label} adicionado.`,
        onFocus: ({label}) => label,
      }}/>
    <p id={id + '-help'} className="language-select-help">Use vírgula ou Enter para adicionar.</p>
    {error && <p id={id + '-error'} className="error-text" role="alert">{error}</p>}
  </div>;
}
