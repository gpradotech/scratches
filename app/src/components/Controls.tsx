import type {ComponentProps, ReactNode} from 'react';

export type ButtonVariant = 'secondary' | 'primary' | 'danger' | 'ghost';
type ButtonProps = ComponentProps<'button'> & {variant?: ButtonVariant};
type LinkSize = 'inherit' | 'sm' | 'xs';
type LinkAppearance = {underline?: boolean; size?: LinkSize; tone?: 'neutral' | 'accent'};
const classes = (...names: (string | undefined)[]) => names.filter(Boolean).join(' ');

export function Button({variant = 'secondary', className, type = 'button', ...props}: ButtonProps) {
  return <button {...props} type={type} className={classes('ui-button button', className)} data-variant={variant}/>;
}
export function ButtonLink({variant = 'secondary', className, ...props}: ComponentProps<'a'> & {variant?: ButtonVariant}) {
  return <a {...props} className={classes('ui-button button', className)} data-variant={variant}/>;
}
export function FileButton({className, ...props}: ComponentProps<'label'>) {
  return <label {...props} className={classes('ui-button button file-input', className)} data-variant="secondary"/>;
}
export function IconButton({variant = 'ghost', tone = 'neutral', className, type = 'button', ...props}: Omit<ButtonProps, 'variant'> & {variant?: ButtonVariant | 'plain'; tone?: 'neutral' | 'danger'}) {
  return <button {...props} type={type} className={classes('ui-icon-button icon-button', className)} data-variant={variant} data-tone={tone}/>;
}
export function TextLink({underline = true, size = 'inherit', tone = 'neutral', className, ...props}: ComponentProps<'a'> & LinkAppearance) {
  return <a {...props} className={classes('ui-text-link', className)} data-underline={underline} data-size={size} data-tone={tone}/>;
}
export function TextAction({underline = true, size = 'sm', tone = 'neutral', className, type = 'button', ...props}: ComponentProps<'button'> & LinkAppearance) {
  return <button {...props} type={type} className={classes('ui-text-link text-button', className)} data-underline={underline} data-size={size} data-tone={tone}/>;
}
// Whole-card and brand links retain their surface layout rather than underlining a block.
export function SurfaceLink({className, ...props}: ComponentProps<'a'>) {
  return <a {...props} className={classes('ui-surface-link', className)}/>;
}
export function ButtonLabel({className, ...props}: ComponentProps<'span'>) {
  return <span {...props} className={classes('ui-button button', className)} data-variant="secondary"/>;
}
export function CountBadge({className, ...props}: ComponentProps<'span'>) {
  return <span {...props} className={classes('ui-count-badge', className)}/>;
}
export function SegmentedControl<Value extends string>({value, onChange, options, label}: {
  value: Value; onChange: (value: Value) => void; label: string;
  options: readonly {value: Value; label: ReactNode}[];
}) {
  return <div className="segment" role="group" aria-label={label}>{options.map(option =>
    <Button key={option.value} variant={value === option.value ? 'primary' : 'ghost'} aria-pressed={value === option.value}
      onClick={() => onChange(option.value)}>{option.label}</Button>)}</div>;
}
