import {IconButton} from './Controls.tsx';
import {useEffect, useId, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './UI.tsx';

export function HelpTooltip({label, text}: {label: string; text: string}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [position, setPosition] = useState({left: 0, top: 0});
  const cancelClose = () => {clearTimeout(closeTimer.current);};
  const show = () => {cancelClose(); setOpen(true);};
  const leave = () => {
    cancelClose();
    if (!pinned && document.activeElement !== trigger.current) closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!trigger.current || !tooltip.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = tooltip.current.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      setPosition({
        left: Math.max(12, Math.min(anchor.left, width - box.width - 12)),
        top: anchor.bottom + box.height + 8 <= height - 12 ? anchor.bottom + 8 : Math.max(12, anchor.top - box.height - 8),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);};
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = () => {clearTimeout(closeTimer.current); setOpen(false); setPinned(false);};
    const key = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault(); event.stopPropagation(); dismiss();}};
    const outside = (event: PointerEvent) => {if (event.target instanceof Node && !trigger.current?.contains(event.target) && !tooltip.current?.contains(event.target)) dismiss();};
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', outside);
    return () => {document.removeEventListener('keydown', key, true); document.removeEventListener('pointerdown', outside);};
  }, [open]);
  return <>
    <IconButton variant="plain" ref={trigger} type="button" className="help-tooltip-trigger" aria-label={'Sobre ' + label} aria-describedby={open ? id : undefined}
      onFocus={show} onBlur={() => {cancelClose(); setOpen(false); setPinned(false);}}
      onPointerEnter={event => {if (event.pointerType === 'mouse') show();}} onPointerLeave={leave}
      onClick={() => {cancelClose(); setOpen(!pinned); setPinned(!pinned);}}><Icon name="info" size={16}/></IconButton>
    {open && createPortal(<span id={id} ref={tooltip} className="help-tooltip" role="tooltip" style={position}
      onPointerEnter={cancelClose} onPointerLeave={leave}>{text}</span>, trigger.current?.closest('dialog') ?? document.body)}
  </>;
}
