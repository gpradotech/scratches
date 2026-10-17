import {components} from 'react-select';
import type {DropdownIndicatorProps, MultiValueRemoveProps, OptionProps} from 'react-select';
import {Icon} from './UI.tsx';

export function SelectMultiValueRemove<Option extends {label: string}>(props: MultiValueRemoveProps<Option, true>) {
  return <components.MultiValueRemove {...props} innerProps={{...props.innerProps, 'aria-label': 'Remover ' + props.data.label}}><Icon name="close" size={13}/></components.MultiValueRemove>;
}

export function SelectDropdownIndicator<Option, IsMulti extends boolean = true>(props: DropdownIndicatorProps<Option, IsMulti>) {
  return <components.DropdownIndicator {...props}><Icon name="chevron" size={18}/></components.DropdownIndicator>;
}

export function CheckedSelectOption<Option extends {value: string; label: string}, IsMulti extends boolean = true>(props: OptionProps<Option, IsMulti>) {
  return <components.Option {...props}>
    <span className="select-option-label">{props.children}</span>
    <span className="select-option-check" aria-hidden="true">{props.isSelected && <Icon name="check" size={18}/>}</span>
  </components.Option>;
}
