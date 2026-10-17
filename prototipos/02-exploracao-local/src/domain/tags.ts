import {normalize} from './model.ts';

export type TagKind = 'themes' | 'mood';
export interface TagInputState {tags: string[]; draft: string; error: string}
const cleanTag = (value: string) => value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');

// Keep unfinished or invalid input available for correction instead of discarding it.
export function splitTags(current: readonly string[], input: string, kind: TagKind, finish = false): TagInputState {
  const tags: string[] = [];
  const keys = new Set<string>();
  for (const tag of current) {
    const clean = cleanTag(tag);
    const key = normalize(clean);
    if (clean && !keys.has(key)) {tags.push(clean); keys.add(key);}
  }
  const parts = input.split(',');
  const count = finish ? parts.length : parts.length - 1;
  for (let index = 0; index < count; index++) {
    const tag = cleanTag(parts[index]);
    const key = normalize(tag);
    if (!tag || keys.has(key)) continue;
    const error = kind === 'mood'
      ? [...tags, tag].join(', ').length > 100 ? 'O clima da letra pode ter até 100 caracteres no total.' : ''
      : tag.length > 100 ? 'Cada tema pode ter até 100 caracteres.' : tags.length >= 30 ? 'Use até 30 temas.' : '';
    if (error) return {tags, draft: parts.slice(index).join(','), error};
    tags.push(tag); keys.add(key);
  }
  return {tags, draft: finish ? '' : parts.at(-1) ?? '', error: ''};
}
