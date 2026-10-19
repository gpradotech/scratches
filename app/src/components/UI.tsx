import {IconButton} from './Controls.tsx';
import {Artwork} from './Artwork.tsx';
import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import {MagnifyingGlassIcon} from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import {ArrowRightIcon} from '@phosphor-icons/react/dist/csr/ArrowRight';
import {ArrowLeftIcon} from '@phosphor-icons/react/dist/csr/ArrowLeft';
import {ArrowUpIcon} from '@phosphor-icons/react/dist/csr/ArrowUp';
import {ArrowDownIcon} from '@phosphor-icons/react/dist/csr/ArrowDown';
import {ArrowSquareOutIcon} from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import {XIcon} from '@phosphor-icons/react/dist/csr/X';
import {PlusIcon} from '@phosphor-icons/react/dist/csr/Plus';
import {FolderSimpleIcon} from '@phosphor-icons/react/dist/csr/FolderSimple';
import {FileTextIcon} from '@phosphor-icons/react/dist/csr/FileText';
import {SlidersHorizontalIcon} from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import {CaretDownIcon} from '@phosphor-icons/react/dist/csr/CaretDown';
import {CaretUpIcon} from '@phosphor-icons/react/dist/csr/CaretUp';
import {ClockIcon} from '@phosphor-icons/react/dist/csr/Clock';
import {DownloadSimpleIcon} from '@phosphor-icons/react/dist/csr/DownloadSimple';
import {UploadSimpleIcon} from '@phosphor-icons/react/dist/csr/UploadSimple';
import {CheckIcon} from '@phosphor-icons/react/dist/csr/Check';
import {TrashIcon} from '@phosphor-icons/react/dist/csr/Trash';
import {DesktopIcon} from '@phosphor-icons/react/dist/csr/Desktop';
import {InfoIcon} from '@phosphor-icons/react/dist/csr/Info';
import {PencilSimpleIcon} from '@phosphor-icons/react/dist/csr/PencilSimple';
import {CaretLineLeftIcon} from '@phosphor-icons/react/dist/csr/CaretLineLeft';
import {CaretLineRightIcon} from '@phosphor-icons/react/dist/csr/CaretLineRight';
import {CaretLeftIcon} from '@phosphor-icons/react/dist/csr/CaretLeft';
import {CaretRightIcon} from '@phosphor-icons/react/dist/csr/CaretRight';
import {ListBulletsIcon} from '@phosphor-icons/react/dist/csr/ListBullets';
import {SquaresFourIcon} from '@phosphor-icons/react/dist/csr/SquaresFour';
import type {Track} from '../domain/model.ts';
const icons = {
  search: MagnifyingGlassIcon, arrow: ArrowRightIcon, 'arrow-left': ArrowLeftIcon,
  'arrow-up': ArrowUpIcon, 'arrow-down': ArrowDownIcon, external: ArrowSquareOutIcon,
  close: XIcon, plus: PlusIcon, folder: FolderSimpleIcon, file: FileTextIcon,
  sliders: SlidersHorizontalIcon, chevron: CaretDownIcon, 'caret-up': CaretUpIcon, clock: ClockIcon, download: DownloadSimpleIcon,
  upload: UploadSimpleIcon, check: CheckIcon, trash: TrashIcon, monitor: DesktopIcon, info: InfoIcon, pencil: PencilSimpleIcon,
  'first-page': CaretLineLeftIcon, 'last-page': CaretLineRightIcon, 'previous-page': CaretLeftIcon, 'next-page': CaretRightIcon,
  list: ListBulletsIcon, gallery: SquaresFourIcon,
};
export type IconName = keyof typeof icons;
export function Icon({name, size = 20, weight = 'regular'}: {name: IconName; size?: number; weight?: 'regular' | 'fill'}) {
  const Glyph = icons[name];
  return <Glyph size={size} weight={weight} aria-hidden="true" focusable="false"/>;
}
export function Cover({track, large = false}: {track: Track; large?: boolean}) {return <Artwork source={track.cover} className={'cover' + (large ? ' large' : '')} alt={'Capa de ' + (track.catalogAlbum || track.title)} fallback={<span className={'cover cover-fallback' + (large ? ' large' : '')}><Icon name="file"/></span>}/>;}
export function Empty({title, children, action}: {title: string; children?: ReactNode; action?: ReactNode}) {return <div className="empty"><span className="empty-icon"><Icon name="folder" size={28}/></span><h2>{title}</h2><div className="muted">{children}</div>{action}</div>;}
export function Dialog({title, onClose, children, className = '', closeDisabled = false}: {title: string; onClose: () => void; children: ReactNode; className?: string; closeDisabled?: boolean}) {
  const ref = useRef<HTMLDialogElement>(null); const closer = useRef(onClose); closer.current = onClose;
  useEffect(() => {const previous = document.activeElement as HTMLElement | null; const node = ref.current!; node.showModal(); return () => {node.close(); if (previous?.isConnected) previous.focus();};}, []);
  return <dialog ref={ref} className={'dialog ' + className} aria-label={title} onCancel={e => {e.preventDefault(); if (!closeDisabled) closer.current();}} onClick={e => {if (e.target === e.currentTarget && !closeDisabled) closer.current();}}>
    <div className="dialog-content"><div className="dialog-heading"><h2>{title}</h2><IconButton onClick={onClose} disabled={closeDisabled} aria-label="Fechar"><Icon name="close"/></IconButton></div>{children}</div>
  </dialog>;
}
