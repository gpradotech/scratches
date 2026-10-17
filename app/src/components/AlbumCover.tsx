import type {CatalogAlbum} from '../domain/albums.ts';
import {Cover, Icon} from './UI.tsx';

export function AlbumCover({album, large = false}: {album: CatalogAlbum; large?: boolean}) {
  return album.coverTrack ? <Cover track={album.coverTrack} large={large}/>
    : <span className={'cover album-cover-fallback' + (large ? ' large' : '')} role="img" aria-label={'Capa de ' + album.title + ' não disponível'}><Icon name="file" size={44}/></span>;
}
