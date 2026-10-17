import {useEffect, useId, useRef, useState} from 'react';
import {Button} from './Controls.tsx';
import {Dialog} from './UI.tsx';
import {SelectField} from './SelectField.tsx';
import './feedbackDialog.css';

export interface FeedbackDraft {id: string; kind: 'problem' | 'suggestion' | 'other'; message: string; email: string}
const feedbackKinds: readonly {value: FeedbackDraft['kind']; label: string}[] = [
  {value: 'problem', label: 'Problema'}, {value: 'suggestion', label: 'Sugestão'}, {value: 'other', label: 'Outro'},
];
export const emptyFeedbackDraft = (): FeedbackDraft => ({id: crypto.randomUUID(), kind: 'suggestion', message: '', email: ''});
export function FeedbackDialog({draft, onChange, onClose, onSent}: {draft: FeedbackDraft; onChange: (draft: FeedbackDraft) => void; onClose: () => void; onSent: () => void}) {
  const id = useId();
  const [availability, setAvailability] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setAvailability('loading');
    fetch('/api/feedback', {signal: controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error();
      setAvailability(data.available === true ? 'available' : 'unavailable');
    }).catch(error => {if (error.name !== 'AbortError') setAvailability('unavailable');});
    return () => controller.abort();
  }, [attempt]);
  function change<Key extends 'kind' | 'message' | 'email'>(key: Key, value: FeedbackDraft[Key]) {
    onChange({...draft, [key]: value, id: crypto.randomUUID()}); setError('');
  }
  async function submit() {
    if (submitting.current || availability !== 'available') return;
    submitting.current = true; setPending(true); setError('');
    try {
      const response = await fetch('/api/feedback', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Scratches-Feedback': '1'}, body: JSON.stringify({...draft, email: draft.email.trim()}), signal: AbortSignal.timeout(20000)});
      const data = await response.json();
      if (!response.ok || data.accepted !== true) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível enviar agora. Tente novamente.');
      onSent();
    } catch (error) {setError(error instanceof Error && !['TimeoutError', 'AbortError', 'TypeError'].includes(error.name) ? error.message : 'Não foi possível confirmar o envio. Tente novamente; sua mensagem continua aqui.');}
    finally {submitting.current = false; setPending(false);}
  }
  return <Dialog title="Enviar feedback" onClose={onClose} closeDisabled={pending} className="feedback-dialog">
    <p className="muted">Encontrou um problema ou tem uma sugestão? Conte para a gente.</p>
    <form className="feedback-form" onSubmit={event => {event.preventDefault(); void submit();}} aria-busy={pending}>
      {availability !== 'available' && <div className="feedback-availability" role="status"><p>{availability === 'loading' ? 'Verificando disponibilidade do envio…' : 'O envio de feedback ainda não está disponível. Sua mensagem não foi enviada.'}</p>{availability === 'unavailable' && <Button className="small" onClick={() => setAttempt(value => value + 1)}>Verificar novamente</Button>}</div>}
      <SelectField label="Tipo" value={[draft.kind]} options={feedbackKinds} multiple={false} clearable={false} searchable={false} disabled={pending}
        onChange={([kind]) => {if (kind) change('kind', kind);}}/>
      <label htmlFor={id + '-message'}>Mensagem<textarea id={id + '-message'} rows={5} required minLength={10} maxLength={4000} value={draft.message} disabled={pending} aria-describedby={id + '-message-help'} onChange={event => change('message', event.target.value)} placeholder="Conte o que aconteceu ou o que você gostaria de melhorar."/></label>
      <p id={id + '-message-help'} className="caption feedback-field-help">De 10 a 4.000 caracteres. Para relatar um problema, descreva os passos e o resultado esperado.</p>
      <label htmlFor={id + '-email'}>Seu e-mail <span className="muted">(opcional)</span><input id={id + '-email'} type="email" autoComplete="email" maxLength={254} value={draft.email} disabled={pending} aria-describedby={id + '-email-help'} onChange={event => change('email', event.target.value)}/></label>
      <p id={id + '-email-help'} className="caption feedback-field-help">Informe apenas se quiser receber uma resposta.</p>
      <p className="caption feedback-privacy">Somente o que você preencher neste formulário será enviado. Seus projetos, letras e arquivos não acompanham a mensagem.</p>
      {error && <p role="alert" className="error-text">{error}</p>}
      <div className="dialog-actions"><Button disabled={pending} onClick={onClose}>Cancelar</Button><Button variant="primary" type="submit" disabled={pending || availability !== 'available' || draft.message.trim().length < 10}>{pending ? 'Enviando…' : 'Enviar feedback'}</Button></div>
    </form>
  </Dialog>;
}
