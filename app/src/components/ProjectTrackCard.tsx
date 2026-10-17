import type {ReactNode} from 'react';
import type {Track} from '../domain/model.ts';
import {duration} from '../domain/model.ts';
import {albumUrl, artistUrl, trackUrl} from '../routing.ts';
import {CountBadge, TextLink} from './Controls.tsx';
import {Cover, Icon} from './UI.tsx';

function ProjectTrackIdentity({track, trackId}: {track?: Track; trackId: string}) {
  return <>
    {track ? <Cover track={track} large/> : <span className="cover cover-fallback"><Icon name="file"/></span>}
    <span className="project-track-identity">
      <strong>{track ? <TextLink underline={false} className="project-track-title" href={trackUrl(track.id)} onClick={event => event.stopPropagation()}>{track.title}</TextLink> : 'Música fora do catálogo atual'}</strong>
      <span className="metadata">{track ? <>
        {track.artists.map((artist, index) => <span key={artist.id}>{index > 0 && ', '}<TextLink href={artistUrl(artist.id)} onClick={event => event.stopPropagation()}>{artist.name}</TextLink></span>)}
        {' · '}<TextLink href={albumUrl(track)} onClick={event => event.stopPropagation()}>{track.album}</TextLink>
        {' · '}{duration(track.duration)}
      </> : trackId}</span>
    </span>
  </>;
}

export function ProjectTrackCard({track, trackId, count, children}: {track?: Track; trackId: string; count?: number; children: ReactNode}) {
  const identity = <ProjectTrackIdentity track={track} trackId={trackId}/>;
  const excerpts = <div className="project-track-excerpts">{children}</div>;
  return count !== undefined ? <details className="project-track-card track-surface" open>
    <summary className="project-track-header">
      {identity}<CountBadge className="project-track-count">{count} {count === 1 ? 'trecho' : 'trechos'}</CountBadge>
      <span className="project-track-chevron" aria-hidden="true"><Icon name="chevron"/></span>
    </summary>
    {excerpts}
  </details> : <article className="project-track-card track-surface">
    <div className="project-track-header">{identity}</div>
    {excerpts}
  </article>;
}
