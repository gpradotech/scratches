import {TextField} from './FormField.tsx';
import {useState} from 'react';
import {Button, FileButton} from './Controls.tsx';
import {Icon} from './UI.tsx';
import {uploadedCover} from '../domain/model.ts';

export async function prepareCover(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !file.size || file.size > 10000000) throw new Error('Escolha uma imagem PNG, JPG ou WebP de até 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 80000000) throw new Error('Escolha uma imagem com dimensões menores.');
    const ratio = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a imagem.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const encoded = canvas.toDataURL('image/webp', .85);
    if (!uploadedCover(encoded)) throw new Error('A imagem excede o tamanho disponível. Escolha uma imagem menor.');
    return encoded;
  } finally {bitmap.close();}
}
export function CoverInput({value, onChange, disabled, onBusy}: {value: string; onChange: (value: string) => void; disabled: boolean; onBusy: (busy: boolean) => void}) {
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string>(); const uploaded = uploadedCover(value);
  return <div className="cover-upload-field">
    <TextField label="Capa" aria-label="Endereço da capa" maxLength={2000} value={uploaded ? '' : value} disabled={disabled || loading} onChange={e => {onChange(e.target.value); setError('');}} placeholder={uploaded ? 'Imagem carregada; cole um endereço para substituir' : 'Cole um endereço https://… ou escolha uma imagem'}/>
    <div className="cover-upload-actions"><FileButton className={disabled || loading ? 'is-disabled' : ''}><Icon name="upload" size={17}/>{loading ? 'Preparando imagem…' : 'Escolher imagem'}<input aria-label="Enviar imagem da capa" type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled || loading} onChange={e => {
      const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
      setLoading(true); onBusy(true); setError('');
      void prepareCover(file).then(onChange).catch(e => setError(e instanceof Error ? e.message : 'Não foi possível abrir essa imagem.')).finally(() => {setLoading(false); onBusy(false);});
    }}/></FileButton>{value && <Button disabled={disabled || loading} onClick={() => onChange('')}>Remover capa</Button>}
      <span className="caption">PNG, JPG ou WebP, até 10 MB. A imagem enviada fica salva no computador e no backup.</span></div>
    {value && failed !== value && <img className="cover-upload-preview" src={value} alt="Prévia da capa" onError={() => setFailed(value)}/>}
    {error && <p className="error-text" role="alert">{error}</p>}
  </div>;
}
