import {useId} from 'react';
import type {ComponentProps, ReactNode, Ref} from 'react';

export function FormField({id, label, help, children, className = '', ref}: {id: string; label: ReactNode; help?: ReactNode; children: ReactNode; className?: string; ref?: Ref<HTMLDivElement>}) {
  return <div ref={ref} className={'ui-field ' + className}>
    <div className="ui-field__label-row"><label htmlFor={id}>{label}</label>{help}</div>
    {children}
  </div>;
}
export function FieldInput({className = '', ...props}: Omit<ComponentProps<'input'>, 'size'>) {
  return <input {...props} className={'ui-input ' + className}/>;
}
export function TextField({label, hint, className = '', id: providedId, ...props}: Omit<ComponentProps<'input'>, 'size'> & {label: ReactNode; hint?: ReactNode}) {
  const generatedId = useId(); const id = providedId ?? generatedId;
  return <FormField id={id} label={label} className={className}><FieldInput {...props} id={id}/>{hint && <span className="caption">{hint}</span>}</FormField>;
}
