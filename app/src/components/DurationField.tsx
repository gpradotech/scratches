import {useLayoutEffect, useRef} from 'react';
import {TextField} from './FormField.tsx';
import {durationInput} from '../domain/trackFields.ts';

export function DurationField({value, onChange, disabled = false}: {value: string; onChange: (value: string) => void; disabled?: boolean}) {
  const input = useRef<HTMLInputElement>(null);
  const digits = useRef(value.replace(/:/g, '').replace(/^0+/, ''));
  const displayed = useRef(value); const position = useRef(false);
  // Preserve o buffer: 61 -> 610 deve produzir 00:06:10, não 00:10:10.
  if (displayed.current !== value) {digits.current = value.replace(/:/g, '').replace(/^0+/, ''); displayed.current = value;}
  function update(raw: string) {
    const next = durationInput(raw); if (next === null) return;
    digits.current = raw.replace(/:/g, ''); displayed.current = next; position.current = true;
    onChange(next);
    requestAnimationFrame(() => input.current?.setSelectionRange(next.length, next.length));
  }
  useLayoutEffect(() => {if (position.current) {input.current?.setSelectionRange(value.length, value.length); position.current = false;}}, [value]);
  return <TextField ref={input} label="Duração" disabled={disabled} inputMode="numeric" autoComplete="off" placeholder="HH:MM:SS"
    title="Digite até seis números, da direita para a esquerda. Minutos e segundos acima de 59 são convertidos. Máximo: 99:59:59."
    value={value} onPaste={event => {event.preventDefault(); update(event.clipboardData.getData('text').trim());}}
    onChange={event => {
      const native = event.nativeEvent as InputEvent;
      if (native.inputType?.startsWith('delete')) update(digits.current.slice(0, -1));
      else if (native.data && /^\d+$/.test(native.data)) update(event.target.value === native.data ? native.data : digits.current + native.data);
      else update(event.target.value);
    }}
    onKeyDown={event => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) return;
      const all = event.currentTarget.selectionStart === 0 && event.currentTarget.selectionEnd === value.length;
      if (/^\d$/.test(event.key)) {event.preventDefault(); update((all ? '' : digits.current) + event.key);}
      else if (event.key === 'Backspace' || event.key === 'Delete') {event.preventDefault(); update(all ? '' : digits.current.slice(0, -1));}
      else if (event.key.length === 1) event.preventDefault();
    }}/>;
}
