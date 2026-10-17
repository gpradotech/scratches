import {Button} from './Controls.tsx';
import {useId, useState} from 'react';
import {pageSizes} from '../domain/pagination.ts';
import type {PaginationState} from '../domain/pagination.ts';
import {Icon} from './UI.tsx';

export function Pagination({state, onChange, kind = 'tracks', pageSizeOptions = pageSizes}: {state: PaginationState; onChange: (page: number, pageSize: number) => void; kind?: 'tracks' | 'albums' | 'releases'; pageSizeOptions?: readonly number[]}) {
  const id = useId();
  const {page, pageSize, total, totalPages, start, end} = state;
  const noun = kind === 'releases' ? 'lançamentos' : kind === 'albums' ? 'álbuns' : 'músicas';
  const totalNoun = total === 1 ? kind === 'releases' ? 'lançamento' : kind === 'albums' ? 'álbum' : 'música' : noun;
  const capacity = kind === 'releases' ? 'Lançamentos por página' : kind === 'albums' ? 'Álbuns por página' : 'Músicas por página';
  const [draft, setDraft] = useState(String(page));
  const applyPage = () => {
    const next = draft ? Math.min(totalPages, Math.max(1, Number(draft))) : page;
    setDraft(String(next)); onChange(next, pageSize);
  };
  return <nav className="pagination" aria-label={'Paginação de ' + noun}>
    <div className="pagination-capacity"><label htmlFor={id + '-capacity'}>{capacity}</label>
      <select id={id + '-capacity'} value={pageSize} onChange={event => onChange(1, Number(event.target.value))}>{pageSizeOptions.map(size => <option key={size} value={size}>{size}</option>)}</select>
    </div>
    <span className="pagination-range" role="status" aria-live="polite" aria-atomic="true">{total ? start + 1 : 0}–{end} de {total} {totalNoun}</span>
    <div className="pagination-controls">
      <Button variant="ghost" type="button" className="pagination-button" aria-label={'Primeira página de ' + noun} title="Primeira página" disabled={page === 1} onClick={() => onChange(1, pageSize)}><Icon name="first-page" size={19}/></Button>
      <Button variant="ghost" type="button" className="pagination-button" aria-label={'Página anterior de ' + noun} disabled={page === 1} onClick={() => onChange(page - 1, pageSize)}><Icon name="previous-page" size={19}/><span className="pagination-nav-label">Anterior</span></Button>
      <div className="pagination-page"><label htmlFor={id + '-page'}>Página</label>
        <input id={id + '-page'} aria-describedby={id + '-total'} type="text" inputMode="numeric" autoComplete="off" value={draft}
          onChange={event => {if (/^\d*$/.test(event.target.value)) setDraft(event.target.value);}}
          onBlur={applyPage} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); applyPage();}}}/>
        <span id={id + '-total'}>de {totalPages}</span>
      </div>
      <Button variant="ghost" type="button" className="pagination-button" aria-label={'Próxima página de ' + noun} disabled={page === totalPages} onClick={() => onChange(page + 1, pageSize)}><span className="pagination-nav-label">Próxima</span><Icon name="next-page" size={19}/></Button>
      <Button variant="ghost" type="button" className="pagination-button" aria-label={'Última página de ' + noun} title="Última página" disabled={page === totalPages} onClick={() => onChange(totalPages, pageSize)}><Icon name="last-page" size={19}/></Button>
    </div>
  </nav>;
}
