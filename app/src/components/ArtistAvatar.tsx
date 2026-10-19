import {Artwork} from './Artwork.tsx';
import './artistAvatar.css';

export function ArtistAvatar({name, picture}: {name: string; picture?: string | null}) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase('pt-BR') ?? '?';
  return <span className="artist-avatar" aria-hidden="true">
    <Artwork source={picture} alt="" fallback={initial}/>
  </span>;
}
