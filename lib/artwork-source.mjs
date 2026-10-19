// Provider URLs only; local paths, uploads and other providers retain their source.
export const providerArtwork = source => typeof source === 'string' && /^https:\/\/(?:cdn-images|cdns-images|e-cdns-images)\.dzcdn\.net\/images\/(?:cover|artist)\/[a-f0-9]{32}\/(?:56|120|200|250|500|1000)x(?:56|120|200|250|500|1000)(?:-000000-80-0-0)?\.jpg$/.test(source);
export function artworkSources(catalog, workspace = {}) {
  return [...new Set([
    ...[...catalog.tracks, ...Object.values(workspace.tracks ?? {})].map(track => track.cover),
    ...[...catalog.artists, ...(workspace.metadata?.artists ?? [])].map(artist => artist.picture),
    ...(workspace.metadata?.albums ?? []).map(album => album.cover),
  ].filter(providerArtwork))];
}
