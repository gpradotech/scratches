import {useLayoutEffect, useRef, useState} from 'react';
import type {Artist, Track} from '../domain/model.ts';
import {artistUrl} from '../routing.ts';
import {SurfaceLink, TextAction, TextLink} from './Controls.tsx';
import {Dialog} from './UI.tsx';
import {ArtistAvatar} from './ArtistAvatar.tsx';

export function TrackArtists({track, artistProfiles, collapsed = false}: {track: Track; artistProfiles?: readonly Artist[]; collapsed?: boolean}) {
  const container = useRef<HTMLDivElement>(null);
  const measurement = useRef<HTMLSpanElement>(null);
  const names = useRef<HTMLSpanElement>(null);
  const counter = useRef<HTMLSpanElement>(null);
  const [visibleCount, setVisibleCount] = useState(track.artists.length);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!collapsed) return;
    let active = true;
    const measure = () => {
      if (!active || !measurement.current || !names.current || !counter.current) return;
      const maxHeight = parseFloat(getComputedStyle(measurement.current).lineHeight) * 2;
      let count = track.artists.length;
      for (; count > 0; count--) {
        const hidden = track.artists.length - count;
        names.current.textContent = track.artists.slice(0, count).map(artist => artist.name).join(', ') + (hidden ? ' ' : '');
        counter.current.textContent = hidden ? '+' + hidden : '';
        if (measurement.current.getBoundingClientRect().height <= maxHeight + .5) break;
      }
      setVisibleCount(count);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container.current!);
    void document.fonts.ready.then(measure);
    return () => {active = false; observer.disconnect();};
  }, [collapsed, track.artists]);
  const count = collapsed ? visibleCount : track.artists.length;
  const hidden = track.artists.length - count;
  return <>
    <div ref={container} className={'metadata track-artists' + (collapsed ? ' track-artists-collapsed' : '')}>
      {track.artists.slice(0, count).map((artist, index) => <span key={artist.id}>{index > 0 && ', '}<TextLink href={artistUrl(artist.id)} title={artist.name}>{artist.name}</TextLink></span>)}
      {hidden > 0 && <> <TextAction className="track-artists-more" size="inherit" aria-label={`Ver todos os ${track.artists.length} artistas de ${track.title}; mais ${hidden} ${hidden === 1 ? 'artista' : 'artistas'}`}
        aria-haspopup="dialog" onClick={() => setOpen(true)}>+{hidden}</TextAction></>}
      {collapsed && <span ref={measurement} className="track-artists-measure" aria-hidden="true"><span ref={names}/><span ref={counter} className="track-artists-counter-measure"/></span>}
    </div>
    {open && <Dialog title="Artistas da música" className="track-artists-dialog" onClose={() => setOpen(false)}>
      <p className="track-artists-song">{track.title}</p>
      <ul className="track-artists-list">{track.artists.map(artist => <li key={artist.id}>
        <SurfaceLink className="artist-list-row track-surface" href={artistUrl(artist.id)}>
          <ArtistAvatar name={artist.name} picture={artistProfiles?.find(profile => profile.id === artist.id)?.picture}/>
          <span>{artist.name}</span>
        </SurfaceLink>
      </li>)}</ul>
    </Dialog>}
  </>;
}
