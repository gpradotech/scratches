export const feedbackKinds = {problem: 'Problema', suggestion: 'Sugestão', other: 'Outro'};
export function validateFeedback(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['id', 'kind', 'message', 'email'].includes(key))) throw new Error('Confira os campos do formulário.');
  if (typeof value.id !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value.id) || !Object.hasOwn(feedbackKinds, value.kind)) throw new Error('Confira os campos do formulário.');
  if (typeof value.message !== 'string' || value.message.trim().length < 10 || value.message.length > 4000) throw new Error('Escreva uma mensagem entre 10 e 4.000 caracteres.');
  if (typeof value.email !== 'string' || value.email.length > 254 || value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) throw new Error('Informe um e-mail válido ou deixe esse campo vazio.');
  return {id: value.id, kind: value.kind, message: value.message.trim(), email: value.email.trim()};
}
export async function readFeedback(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {size += chunk.length; if (size > 24000) throw new Error('A mensagem excede o tamanho permitido.'); chunks.push(Buffer.from(chunk));}
  let value; try {value = JSON.parse(Buffer.concat(chunks).toString('utf8'));} catch {throw new Error('Confira os campos do formulário.');}
  return validateFeedback(value);
}
export function feedbackResponse(res, status, body) {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(body));
}
