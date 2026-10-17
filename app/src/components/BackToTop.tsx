import {IconButton} from './Controls.tsx';
import {useEffect, useState} from 'react';
import type {CSSProperties} from 'react';
import {Icon} from './UI.tsx';

export function BackToTop() {
  const [position, setPosition] = useState({visible: false, bottom: 24});
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const footerTop = document.querySelector('.app-footer')?.getBoundingClientRect().top ?? innerHeight;
      const bottom = Math.max(24, innerHeight - footerTop + 16);
      const visible = window.scrollY > 400;
      setPosition(previous => previous.visible === visible && previous.bottom === bottom ? previous : {visible, bottom});
    };
    const schedule = () => {if (!frame) frame = requestAnimationFrame(measure);};
    measure();
    window.addEventListener('scroll', schedule, {passive: true});
    window.addEventListener('resize', schedule);
    return () => {cancelAnimationFrame(frame); window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);};
  }, []);
  if (!position.visible) return null;
  return <IconButton variant="secondary" type="button" className="back-to-top" style={{'--back-to-top-bottom': position.bottom + 'px'} as CSSProperties} aria-label="Voltar ao topo" title="Voltar ao topo" onClick={() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({top: 0, behavior: reducedMotion ? 'instant' : 'smooth'});
    document.querySelector<HTMLElement>('.app-header .brand')?.focus({preventScroll: true});
  }}><Icon name="arrow-up" size={22}/></IconButton>;
}
