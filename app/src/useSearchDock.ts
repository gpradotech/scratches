import {useLayoutEffect, useRef, useState} from 'react';
import type {RefObject} from 'react';
import {searchDockFrames, searchPlacement} from './domain/searchDock.ts';
import type {SearchPlacement, SearchRect} from './domain/searchDock.ts';

export function useSearchDock(slot: RefObject<HTMLDivElement | null>, module: RefObject<HTMLDivElement | null>) {
  const [placement,setPlacement]=useState<SearchPlacement | null>(null);
  const latest=useRef<SearchPlacement | null>(null);
  const animation=useRef<Animation | null>(null);
  const transition=useRef<{from:SearchRect;scrollY:number;headerBottom:number} | null>(null);
  useLayoutEffect(()=>{
    const header=document.querySelector<HTMLElement>('.app-header');
    const anchor=slot.current;
    if(!header || !anchor) return;
    let frame=0;
    const measure=()=>{
      frame=0;
      const headerBox=header.getBoundingClientRect();
      const next=searchPlacement({anchor:anchor.getBoundingClientRect(),header:headerBox,
        brandRight:header.querySelector('.brand')!.getBoundingClientRect().right,
        navLeft:header.querySelector('nav')!.getBoundingClientRect().left,
        viewportWidth:document.documentElement.clientWidth,scrollX:window.scrollX,scrollY:window.scrollY,wasDocked:!!latest.current?.dock});
      const previous=latest.current;
      if(previous?.left===next.left && previous.top===next.top && previous.width===next.width && previous.dock===next.dock) return;
      if(previous && previous.dock!==next.dock && module.current) {
        const {left,top,width,height}=module.current.getBoundingClientRect();
        transition.current={from:{left,top,width,height},scrollY:window.scrollY,headerBottom:headerBox.bottom};
        animation.current?.cancel();
      }
      latest.current=next;
      setPlacement(next);
    };
    const schedule=()=>{if(!frame) frame=requestAnimationFrame(measure);};
    const observer=new ResizeObserver(schedule);
    observer.observe(header); observer.observe(anchor);
    measure();
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule);
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();animation.current?.cancel();window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
  },[slot,module]);
  useLayoutEffect(()=>{
    const pending=transition.current;
    transition.current=null;
    if(!pending || !placement || !module.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animation.current=module.current.animate(searchDockFrames(pending.from,placement,pending.scrollY,pending.headerBottom),{duration:260,easing:'cubic-bezier(.2,.7,.2,1)'});
  },[placement,module]);
  return placement;
}
