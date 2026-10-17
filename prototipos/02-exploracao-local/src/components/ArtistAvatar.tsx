import {useState} from 'react';
import './artistAvatar.css';

export function ArtistAvatar({name, picture}: {name: string; picture?: string | null}) {
  const [failedPicture, setFailedPicture] = useState<string | null>(null);
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase('pt-BR') ?? '?';
  return <span className="artist-avatar" aria-hidden="true">
    {picture && picture !== failedPicture
      ? <img src={picture} alt="" draggable={false} onError={() => setFailedPicture(picture)}/>
      : initial}
  </span>;
}
