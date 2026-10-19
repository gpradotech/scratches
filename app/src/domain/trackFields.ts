export const durationValue = (seconds: number): string => [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(part => String(Math.floor(part)).padStart(2, '0')).join(':');
// Os dígitos ocupam HHMMSS da direita para a esquerda; a soma transporta os excedentes.
export function durationInput(value: string): string | null {
  if (!/^[\d:]*$/.test(value)) return null;
  const digits = value.replace(/:/g, '');
  if (!digits.length) return '';
  if (digits.length > 6) return null;
  const padded = digits.padStart(6, '0');
  const seconds = Number(padded.slice(0, 2)) * 3600 + Number(padded.slice(2, 4)) * 60 + Number(padded.slice(4));
  return seconds > 359999 ? null : durationValue(seconds);
}
export function trackBpmInput(value: string): string | null {
  return value === '' || /^\d{1,3}(?:[.,]\d{0,2})?$/.test(value) && Number(value.replace(',', '.')) <= 400 ? value : null;
}
