import type {IncomingMessage, ServerResponse} from 'node:http';
import type {Artist, Track} from '../src/domain/model.ts';
import {normalize, uploadedCover} from '../src/domain/model.ts';
import type {MetadataKind, MetadataOption} from '../src/domain/metadata.ts';

export type MusicProvider = 'deezer' | 'itunes';
export interface MusicCandidate {provider: MusicProvider; id: string; title: string; artists: string[]; album: string; duration: number; cover: string | null; link: string | null}
type Json = Record<string, unknown>;
const object = (v: unknown): Json => v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {};
const rows = (v: unknown): Json[] => Array.isArray(v) ? v.map(object) : [];
const text = (v: unknown, max = 300) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
const url = (v: unknown): string | null => {try {const u = new URL(String(v)); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null;} catch {return null;}};
class MetadataError extends Error {status: number; constructor(message: string, status = 502) {super(message); this.status = status;}}
function candidate(provider: MusicProvider, row: Json): MusicCandidate | null {
  const apple = provider === 'itunes';
  const id = String(apple ? row.trackId : row.id);
  const title = text(apple ? row.trackName : row.title);
  const artist = text(apple ? row.artistName : object(row.artist).name, 100);
  if (!/^\d{1,20}$/.test(id) || !title || !artist || (apple && row.kind !== 'song')) return null;
  return {provider, id, title, artists: [artist], album: text(apple ? row.collectionName : object(row.album).title),
    duration: Math.round(positive(apple ? row.trackTimeMillis : row.duration) / (apple ? 1000 : 1)),
    // A consulta Apple é usada apenas para dados e links; não incorpora seus assets promocionais.
    cover: apple ? null : url(object(row.album).cover_medium), link: url(apple ? row.trackViewUrl : row.link)};
}
export function createMusicClient(fetcher: typeof fetch = fetch) {
  const calls: Record<MusicProvider | 'musicbrainz', number[]> = {deezer: [], itunes: [], musicbrainz: []};
  let genresCache: {at: number; items: MetadataOption[]} | undefined;
  const labelsCache = new Map<string, {at: number; items: MetadataOption[]}>();
  const labelsPending = new Map<string, Promise<{items: MetadataOption[]}>>(); let nextLabelAt = 0;
  const images = new Map<string, Promise<string | null>>();
  async function savedImage(address: string | null): Promise<string | null> {
    if (!address || !/^https:\/\/(?:cdn-images|e-cdns-images)\.dzcdn\.net\/images\/(?:cover|artist)\/[a-f0-9]{16,64}\/[\w.-]+\.jpg$/.test(address)) return address;
    if (!images.has(address)) {
      if (images.size >= 32) images.delete(images.keys().next().value!);
      const pending = (async () => {
        try {
          const response = await fetcher(address, {signal: AbortSignal.timeout(3000), redirect: 'error'});
          if (!response.ok || !/^image\/(jpeg|png|webp)(?:;|$)/.test(response.headers.get('content-type') ?? '') || Number(response.headers.get('content-length')) > 512000) return null;
          const reader = response.body?.getReader(); if (!reader) return null;
          const chunks: Uint8Array[] = []; let size = 0;
          try {while (true) {const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > 512000) return null; chunks.push(value);}}
          finally {await reader.cancel().catch(() => {});}
          const image = `data:${response.headers.get('content-type')!.split(';')[0]};base64,${Buffer.concat(chunks).toString('base64')}`;
          return uploadedCover(image) ? image : null;
        } catch {return null;}
      })();
      images.set(address, pending);
    }
    const result = await images.get(address)!;
    if (!result) images.delete(address); // Uma falha temporária não deve se tornar permanente.
    return result ?? address;
  }
  async function json(provider: MusicProvider | 'musicbrainz', address: string): Promise<Json> {
    const now = Date.now(); calls[provider] = calls[provider].filter(time => now - time < 60000);
    if (calls[provider].length >= (provider === 'itunes' ? 18 : 40)) throw new MetadataError('Muitas consultas em sequência. Aguarde um minuto ou preencha os dados manualmente.', 429);
    calls[provider].push(now);
    const response = await fetcher(address, {headers: {Accept: 'application/json', 'User-Agent': 'Scratches/0.2.0 (https://github.com/gpradotech/scratches)'}, signal: AbortSignal.timeout(10000), redirect: 'error'});
    if (!response.ok) throw new MetadataError(response.status === 429 ? 'A fonte limitou as consultas. Tente mais tarde ou preencha manualmente.' : 'A fonte de metadados está indisponível.', response.status === 429 ? 429 : 502);
    const result = object(await response.json());
    if (result.error) throw new MetadataError('A música não está disponível nessa fonte. Tente outra versão ou preencha manualmente.', 404);
    return result;
  }
  async function searchProvider(provider: MusicProvider, query: string) {
    const address = provider === 'deezer' ? 'https://api.deezer.com/search?' + new URLSearchParams({q: query, limit: '8'})
      : 'https://itunes.apple.com/search?' + new URLSearchParams({term: query, media: 'music', entity: 'song', country: 'BR', limit: '8'});
    const result = await json(provider, address);
    return rows(provider === 'deezer' ? result.data : result.results).map(row => candidate(provider, row)).filter((item): item is MusicCandidate => !!item);
  }
  return {
    async suggest(kind: MetadataKind, query: string): Promise<{items: MetadataOption[]}> {
      if (!['artist', 'album', 'genre', 'label'].includes(kind) || query.length > 300) throw new MetadataError('Pesquisa de metadados inválida.', 400);
      // O seletor de álbuns usa apenas os álbuns gerenciados no espaço local.
      if (kind === 'album') return {items: []};
      if (kind === 'label') {
        if (query.trim().length < 2) return {items: []};
        const key = normalize(query), cached = labelsCache.get(key);
        if (cached && Date.now() - cached.at < 3600000) return {items: cached.items};
        const pending = labelsPending.get(key); if (pending) return pending;
        const delay = Math.max(0, nextLabelAt - Date.now());
        if (delay > 5000) throw new MetadataError('Aguarde a consulta anterior ou adicione uma gravadora manualmente.', 429);
        nextLabelAt = Math.max(nextLabelAt, Date.now()) + 1100;
        const request = (async () => {
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          const escaped = query.trim().replace(/[+\-&|!(){}\[\]^"~*?:\\/\s]/g, '\\$&');
          const body = await json('musicbrainz', 'https://musicbrainz.org/ws/2/label/?' + new URLSearchParams({query: 'label:' + escaped + '*', fmt: 'json', limit: '12'}));
          const items = [...new Map(rows(body.labels).filter(r => text(r.name)).map(r => {
            const label = text(r.name); return [normalize(label), {value: normalize(label), label, description: ['MusicBrainz', text(r.country, 2), text(r.disambiguation, 100)].filter(Boolean).join(' · ')}] as const;
          })).values()];
          if (labelsCache.size >= 100) labelsCache.delete(labelsCache.keys().next().value!);
          labelsCache.set(key, {at: Date.now(), items}); return {items};
        })();
        labelsPending.set(key, request);
        try {return await request;} finally {labelsPending.delete(key);}
      }
      if (kind === 'genre') {
        if (!genresCache || Date.now() - genresCache.at > 3600000) {
          const body = await json('deezer', 'https://api.deezer.com/genre');
          genresCache = {at: Date.now(), items: rows(body.data).filter(g => positive(g.id) && text(g.name)).map(g => ({value: normalize(text(g.name, 100)), label: text(g.name, 100), description: 'Deezer'}))};
        }
        return {items: genresCache.items.filter(o => normalize(o.label).includes(normalize(query)))};
      }
      if (query.trim().length < 2) return {items: []};
      try {
        const body = await json('deezer', 'https://api.deezer.com/search/artist?' + new URLSearchParams({q: query, limit: '8'}));
        const items: MetadataOption[] = rows(body.data).filter(r => /^\d+$/.test(String(r.id)) && text(r.name)).map(r => {
          const artist = {id: `deezer-artist:${r.id}`, name: text(r.name, 100), picture: url(r.picture_medium)};
          return {value: artist.id, label: artist.name, artist, description: 'Deezer'};
        });
        if (items.length) return {items};
      } catch { /* A busca alternativa não impede reutilizar metadados locais. */ }
      const body = await json('itunes', 'https://itunes.apple.com/search?' + new URLSearchParams({term: query, media: 'music', entity: 'musicArtist', country: 'BR', limit: '8'}));
      const items: MetadataOption[] = rows(body.results).filter(r => /^\d+$/.test(String(r.artistId)) && text(r.artistName)).map(r => {
        const artist = {id: `itunes-artist:${r.artistId}`, name: text(r.artistName, 100), picture: null};
        return {value: artist.id, label: artist.name, artist, description: 'Apple (iTunes)'};
      });
      return {items};
    },
    async search(query: string, provider?: MusicProvider) {
      if (!query.trim() || query.length > 400) throw new MetadataError('Informe um título ou artista com até 400 caracteres.', 400);
      if (provider) return {provider, items: await searchProvider(provider, query), notice: ''};
      let notice = '';
      try {const items = await searchProvider('deezer', query); if (items.length) return {provider: 'deezer', items, notice}; notice = 'Sem correspondências no Deezer. Consulta à Apple (iTunes).';}
      catch {notice = 'Não foi possível consultar o Deezer. Consulta à Apple (iTunes).';}
      return {provider: 'itunes', items: await searchProvider('itunes', query), notice};
    },
    async details(provider: MusicProvider, id: string): Promise<{track: Track; artists: Artist[]; notice: string}> {
      if (!/^\d{1,20}$/.test(id)) throw new MetadataError('Identificador da música inválido.', 400);
      const body = await json(provider, provider === 'deezer' ? `https://api.deezer.com/track/${id}` : 'https://itunes.apple.com/lookup?' + new URLSearchParams({id, entity: 'song', country: 'BR'}));
      const row = provider === 'deezer' ? body : rows(body.results).find(item => String(item.trackId) === id && item.kind === 'song') ?? {};
      const item = candidate(provider, row);
      if (!item || item.id !== id) throw new MetadataError('Não foi possível confirmar essa música na fonte.', 404);
      let album = object(row.album); let notice = '';
      if (provider === 'deezer' && /^\d{1,20}$/.test(String(album.id))) {
        try {album = await json(provider, `https://api.deezer.com/album/${album.id}`);}
        catch {notice = 'Os detalhes do álbum não puderam ser consultados. Confira os campos vazios.';}
      }
      const artists = provider === 'deezer' ? rows(row.contributors).filter(a => a.id && text(a.name)) : [];
      if (provider === 'deezer' && !artists.length) artists.push(object(row.artist));
      const artistEntries = provider === 'itunes' ? [{id: `itunes-artist:${row.artistId}`, name: item.artists[0]}] : artists.map(a => ({id: `deezer-artist:${a.id}`, name: text(a.name, 100)}));
      const bpm = positive(row.bpm);
      const date = text(provider === 'deezer' ? row.release_date : row.releaseDate).slice(0, 10);
      const track: Track = {id: `${provider}:${id}`, title: item.title, artists: [...new Map(artistEntries.map(a => [a.id, a])).values()], album: item.album, albumId: provider === 'deezer' && album.id ? `deezer-album:${album.id}` : provider === 'itunes' && row.collectionId ? `itunes-album:${row.collectionId}` : null,
        duration: item.duration, cover: provider === 'deezer' ? url(album.cover_big) ?? item.cover : null,
        bpm: bpm > 0 && bpm <= 400 ? bpm : null, key: null, mode: null,
        genres: provider === 'deezer' ? rows(object(album.genres).data).map(g => text(g.name, 100)).filter(Boolean) : text(row.primaryGenreName) ? [text(row.primaryGenreName, 100)] : [],
        genreScope: provider === 'deezer' ? 'album' : 'track', releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date ? date : null,
        catalogAlbum: item.album || null, releaseType: ['album', 'single', 'ep', 'compilation'].includes(String(album.record_type)) ? album.record_type as Track['releaseType'] : null,
        source: item.link, sourceMatch: 'selected_by_user', lyricsReferences: [],
        isrc: /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(String(row.isrc)) ? String(row.isrc) : null,
        languages: [], label: text(album.label) || null,
        explicit: provider === 'deezer' ? typeof row.explicit_lyrics === 'boolean' ? row.explicit_lyrics : null : typeof row.trackExplicitness === 'string' ? row.trackExplicitness === 'explicit' : null,
        links: item.link ? [{label: provider === 'deezer' ? 'Deezer' : 'Apple (iTunes)', url: item.link}] : []};
      const profiles: Artist[] = artistEntries.map(artist => ({...artist, picture: provider === 'deezer' ? url(artists.find(row => `deezer-artist:${row.id}` === artist.id)?.picture_medium) : null}));
      await Promise.all([savedImage(track.cover).then(cover => {track.cover = cover;}), ...profiles.slice(0, 4).map(async artist => {artist.picture = await savedImage(artist.picture);})]);
      return {track, artists: profiles, notice};
    },
  };
}
export function musicApi(client = createMusicClient()) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const pathname = req.url?.split('?')[0];
    if (pathname !== '/api/music/search' && pathname !== '/api/music/metadata' && pathname !== '/api/music/suggest') {next(); return;}
    const send = (status: number, body: unknown) => {res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); res.end(JSON.stringify(body));};
    const host = req.headers.host ?? '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') || (req.headers.origin && req.headers.origin !== 'http://' + host) || req.headers['sec-fetch-site'] === 'cross-site') {send(403, {error: 'Acesso permitido apenas pelo aplicativo local.'}); return;}
    if (req.method !== 'GET') {send(405, {error: 'Método não disponível.'}); return;}
    try {
      const params = new URL(req.url!, 'http://' + host).searchParams;
      const provider = params.get('provider');
      if (provider !== null && provider !== 'deezer' && provider !== 'itunes') throw new MetadataError('Fonte de metadados inválida.', 400);
      if (pathname === '/api/music/suggest') {const kind = params.get('kind'); if (kind !== 'artist' && kind !== 'album' && kind !== 'genre' && kind !== 'label') throw new MetadataError('Tipo de metadado inválido.', 400); send(200, await client.suggest(kind, params.get('q') ?? ''));}
      else if (pathname === '/api/music/search') send(200, await client.search(params.get('q') ?? '', provider ?? undefined));
      else {if (!provider) throw new MetadataError('Escolha a fonte da música.', 400); send(200, await client.details(provider, params.get('id') ?? ''));}
    } catch (error) {send(error instanceof MetadataError ? error.status : 502, {error: error instanceof MetadataError ? error.message : 'Não foi possível consultar a fonte. Tente novamente ou preencha os dados manualmente.'});}
  };
}
