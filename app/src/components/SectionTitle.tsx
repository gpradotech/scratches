import type {ComponentProps} from 'react';
import './sectionTitle.css';

export function SectionTitle({count, children, ...props}: ComponentProps<'h2'> & {count: number}) {
  return <h2 {...props}>{children} <small className="section-title-count">({count.toLocaleString('pt-BR')})</small></h2>;
}
