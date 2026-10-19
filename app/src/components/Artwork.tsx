import {useEffect, useState} from 'react';
import type {ReactNode} from 'react';
import {providerArtwork} from '../../../lib/artwork-source.mjs';

export function Artwork({source, ...props}: {source?: string | null; alt: string; className?: string; fallback: ReactNode}) {
  return source ? <ArtworkImage key={source} source={source} {...props}/> : props.fallback;
}
function ArtworkImage({source, alt, className, fallback}: {source: string; alt: string; className?: string; fallback: ReactNode}) {
  const cached = providerArtwork(source);
  const [attempt, setAttempt] = useState(0);
  const failed = attempt >= (cached ? 2 : 1);
  useEffect(() => {
    if (!failed || !cached) return;
    const retry = () => setAttempt(0);
    const timer = window.setTimeout(retry, 35000);
    window.addEventListener('online', retry);
    return () => {window.clearTimeout(timer); window.removeEventListener('online', retry);};
  }, [failed, cached]);
  return failed ? fallback : <img className={className} src={cached && attempt === 0 ? '/api/artwork?source=' + encodeURIComponent(source) : source} alt={alt} loading="lazy" draggable={false} onError={() => setAttempt(value => value + 1)}/>;
}
