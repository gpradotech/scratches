import {FormField} from './FormField.tsx';
import {IconButton} from './Controls.tsx';
import {useId, useLayoutEffect, useRef, useState} from 'react';
import Select from 'react-select';
import type {MultiValueProps} from 'react-select';
import {Icon} from './UI.tsx';
import {HelpTooltip} from './HelpTooltip.tsx';
import {CheckedSelectOption, SelectClearIndicator, SelectDropdownIndicator} from './CheckedSelectOption.tsx';

interface Option<Value extends string = string> {value: Value; label: string}
function SelectionCount<Value extends string>(props: MultiValueProps<Option<Value>, boolean>) {
  if (props.index !== 0) return null;
  const count = props.getValue().length;
  return <span className="language-select__multi-value filter-count-chip">
    <span className="language-select__multi-value__label">{count} {count === 1 ? 'opção' : 'opções'}</span>
    <IconButton variant="plain" type="button" className="language-select__multi-value__remove" aria-label={'Limpar seleções de ' + props.selectProps['aria-label']}
      onMouseDown={event => {event.preventDefault(); event.stopPropagation();}}
      onClick={event => {event.stopPropagation(); props.clearValue(); document.getElementById(props.selectProps.inputId ?? '')?.focus();}}><Icon name="close" size={13}/></IconButton>
  </span>;
}
export function SelectField<Value extends string>({label, value, options, onChange, help, multiple = true, clearable = !multiple, searchable = true, disabled = false, placeholder = 'Qualquer'}: {
  label: string; value: Value[]; options: readonly Option<Value>[]; onChange: (values: Value[]) => void;
  help?: string; multiple?: boolean; clearable?: boolean; searchable?: boolean; disabled?: boolean; placeholder?: string;
}) {
  const choices = options.filter(option => option.value !== '');
  const id = useId();
  const container = useRef<HTMLDivElement>(null);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {setPortal(container.current?.closest('dialog') ?? document.body);}, []);
  return <FormField id={id} label={label} help={help && <HelpTooltip label={label} text={help}/>} className="filter-select-field" ref={container}>
    <Select<Option<Value>, boolean> inputId={id} instanceId={id} aria-label={label} isMulti={multiple} isClearable={clearable} isSearchable={searchable} isDisabled={disabled} unstyled
      className="language-select filter-select" classNamePrefix="language-select" options={choices}
      value={multiple ? value.map(item => choices.find(option => option.value === item) ?? {value: item, label: item}) : choices.find(option => option.value === value[0]) ?? null}
      onChange={items => onChange(!items ? [] : 'value' in items ? [items.value] : items.map(item => item.value))}
      placeholder={placeholder} noOptionsMessage={() => 'Nenhuma opção encontrada.'}
      closeMenuOnSelect={!multiple} hideSelectedOptions={false} tabSelectsValue={false}
      menuPlacement="auto" menuPosition="fixed" menuPortalTarget={portal ?? undefined} maxMenuHeight={230} menuShouldScrollIntoView={false}
      styles={{menuPortal: base => ({...base, zIndex: 40})}}
      components={{DropdownIndicator: SelectDropdownIndicator, Option: CheckedSelectOption, MultiValue: SelectionCount, ClearIndicator: SelectClearIndicator, IndicatorSeparator: null}}
      ariaLiveMessages={{
        guidance: () => multiple ? 'Digite para pesquisar. Use as setas e Enter para selecionar várias opções. Backspace remove a última seleção. Escape recolhe as opções.' : `Use as setas e Enter para escolher uma opção. Uma nova escolha substitui a anterior. ${clearable ? 'Backspace limpa a seleção. ' : ''}Escape recolhe as opções.`,
        onChange: ({label: option, action}) => action === 'clear' ? 'Filtro limpo.' : action === 'remove-value' || action === 'pop-value' || action === 'deselect-option' ? `${option} removido.` : `${option} selecionado.`,
        onFocus: ({label: option}) => option,
      }} screenReaderStatus={({count}) => `${count} opções disponíveis.`}/>
  </FormField>;
}
