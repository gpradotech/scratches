import {useId} from 'react';
import Select from 'react-select';
import {CheckedSelectOption, SelectDropdownIndicator} from './CheckedSelectOption.tsx';

// Compact selector: shares options, selection check and colors with the other selects.
export function TextSelect<Value extends string>({label, value, options, onChange}: {
  label: string; value: Value; options: readonly {value: Value; label: string}[]; onChange: (value: Value) => void;
}) {
  const id = useId();
  return <Select<{value: Value; label: string}, false> inputId={id} instanceId={id} aria-label={label}
    className="text-select" classNamePrefix="language-select" unstyled isSearchable={false}
    options={options} value={options.find(option => option.value === value)} onChange={option => {if (option) onChange(option.value);}}
    components={{Option: CheckedSelectOption, DropdownIndicator: SelectDropdownIndicator, IndicatorSeparator: null}}
    menuPortalTarget={document.body} menuPosition="fixed" menuPlacement="auto" menuShouldScrollIntoView={false}
    styles={{menuPortal: base => ({...base, zIndex: 40, minWidth: 190})}}
    ariaLiveMessages={{
      guidance: () => 'Use as setas para escolher, Enter para selecionar e Escape para fechar.',
      onChange: ({label: option}) => `${option} selecionado.`,
      onFocus: ({label: option}) => option,
    }} screenReaderStatus={({count}) => `${count} opções disponíveis.`}/>;
}
