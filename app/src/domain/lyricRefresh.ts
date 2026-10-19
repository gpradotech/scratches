import type {Workspace} from './model.ts';
// Reaplicar uma ação só é seguro quando a outra gravação acrescentou letras automáticas.
export function onlyNewImportedLyrics(before: Workspace, after: Workspace): boolean {
  const {revision: _beforeRevision, lyrics: previous, ...oldState} = before;
  const {revision: _afterRevision, lyrics: latest, ...newState} = after;
  return JSON.stringify(oldState) === JSON.stringify(newState) &&
    Object.entries(previous).every(([id, lyric]) => JSON.stringify(lyric) === JSON.stringify(latest[id])) &&
    Object.entries(latest).filter(([id]) => !previous[id]).every(([, lyric]) => lyric.revision.startsWith('lrclib:') && /^https:\/\/lrclib\.net\/api\/get\/\d+$/.test(lyric.source));
}
