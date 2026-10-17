import {useEffect, useRef} from 'react';
import type {RefObject} from 'react';

export function usePaginationFocus(heading: RefObject<HTMLHeadingElement | null>, page: number, pageSize: number) {
  const requested = useRef(false);
  useEffect(() => {
    if (!requested.current) return;
    requested.current = false;
    const frame = requestAnimationFrame(() => {heading.current?.focus({preventScroll: true}); heading.current?.scrollIntoView({block: 'start'});});
    return () => cancelAnimationFrame(frame);
  }, [page, pageSize, heading]);
  return requested;
}
