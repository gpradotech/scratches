import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {feedbackApi} from '../lib/feedback-api.mjs';
import {feedbackReceiver} from '../servicos/feedback/server.mjs';

const message = () => ({id: crypto.randomUUID(), kind: 'problem', message: 'O botão não respondeu ao clicar.', email: ''});
async function serve(handler) {
  const server = http.createServer((req, res) => handler(req, res, () => {res.writeHead(404); res.end();}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {url: 'http://127.0.0.1:' + server.address().port + '/api/feedback', close: () => new Promise(resolve => {server.close(resolve); server.closeAllConnections();})};
}
const post = (url, value, headers = {}) => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Scratches-Feedback': '1', ...headers}, body: JSON.stringify(value)});

test('ausência de configuração é explícita e não confirma envio nem expõe configuração', async () => {
  const local = await serve(feedbackApi({endpoint: ''}));
  const remote = await serve(feedbackReceiver({apiKey: '', from: '', to: ''}));
  try {
    assert.deepEqual(await (await fetch(local.url)).json(), {available: false});
    assert.equal((await post(local.url, message())).status, 503);
    assert.deepEqual(await (await fetch(remote.url)).json(), {available: false});
    assert.equal((await post(remote.url, message())).status, 503);
  } finally {await local.close(); await remote.close();}
});

test('formulário passa pelo receptor e Resend, mantendo destinatário e chave fora das respostas', async () => {
  const calls = [];
  const receiver = await serve(feedbackReceiver({apiKey: 'test-secret', from: 'sender@example.invalid', to: 'private@example.invalid', request: async (url, init) => {calls.push({url, init}); return Response.json({id: 'provider-confirmation'});}}));
  const local = await serve(feedbackApi({endpoint: 'https://feedback.example.invalid/api/feedback', request: (_url, options) => fetch(receiver.url, options)}));
  try {
    assert.deepEqual(await (await fetch(local.url)).json(), {available: true});
    const payload = {...message(), email: 'reply@example.invalid'};
    for (let retry = 0; retry < 2; retry++) {
      const response = await post(local.url, payload);
      assert.equal(response.status, 202);
      assert.deepEqual(await response.json(), {accepted: true});
    }
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'https://api.resend.com/emails');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer test-secret');
    assert.equal(calls[0].init.headers['Idempotency-Key'], calls[1].init.headers['Idempotency-Key']);
    assert.deepEqual(JSON.parse(calls[0].init.body), {from: 'sender@example.invalid', to: ['private@example.invalid'], subject: '[Scratches] Problema', text: payload.message, reply_to: payload.email});
  } finally {await local.close(); await receiver.close();}
});

test('erros do provedor não revelam destinatário, credenciais ou detalhes internos', async () => {
  const receiver = await serve(feedbackReceiver({apiKey: 'test-secret', from: 'sender@example.invalid', to: 'private@example.invalid', request: async () => Response.json({error: 'private@example.invalid test-secret'}, {status: 401})}));
  try {
    const response = await post(receiver.url, message());
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.ok(!body.includes('private@') && !body.includes('test-secret'));
    assert.ok(!body.includes('accepted'));
  } finally {await receiver.close();}
});

test('cliente não escolhe destinatário e corpo inválido não chega ao provedor', async () => {
  let sent = 0;
  const local = await serve(feedbackApi({endpoint: 'https://feedback.example.invalid/api/feedback', request: async () => {sent++; return Response.json({accepted: true});}}));
  try {
    for (const payload of [{...message(), to: 'other@example.invalid'}, {...message(), message: 'curta'}, {...message(), email: 'invalid'}, {...message(), id: 'invalid'}]) assert.equal((await post(local.url, payload)).status, 400);
    assert.equal(sent, 0);
    assert.equal((await post(local.url, message(), {Origin: 'https://foreign.example.invalid'})).status, 403);
    assert.equal((await post(local.url, message(), {'X-Scratches-Feedback': ''})).status, 403);
    assert.equal(sent, 0);
  } finally {await local.close();}
});

test('limite de tentativas protege o receptor e sucesso exige aceite explícito', async () => {
  const receiver = await serve(feedbackReceiver({apiKey: 'test-secret', from: 'sender@example.invalid', to: 'private@example.invalid', request: async () => Response.json({id: 'provider-confirmation'})}));
  const local = await serve(feedbackApi({endpoint: 'https://feedback.example.invalid/api/feedback', request: async () => Response.json({ok: true})}));
  try {
    for (let index = 0; index < 5; index++) assert.equal((await post(receiver.url, message())).status, 202);
    assert.equal((await post(receiver.url, message())).status, 429);
    assert.equal((await post(local.url, message())).status, 502);
  } finally {await receiver.close(); await local.close();}
});
