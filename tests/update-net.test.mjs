import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {EventEmitter, once} from 'node:events';
import {Readable} from 'node:stream';
import {remote, smallBody} from '../lib/update-net.mjs';
import {UpdateManager} from '../lib/updates.mjs';
import {fixture, cleanFixture} from './update-fixtures.mjs';

function replies(t, responses) {
  const drained=[];
  t.mock.method(https,'request',(_url,options,callback)=>{
    const next=responses.shift(); assert.ok(next,'requisição inesperada');
    next.check?.(options);
    const incoming=Readable.from(next.body ? [Buffer.from(next.body)] : []);
    incoming.statusCode=next.status;incoming.headers=next.headers || {};
    if([204,205,304].includes(next.status) || options.method.toUpperCase()==='HEAD')drained.push(once(incoming,'end'));
    const request=new EventEmitter();
    request.end=()=>queueMicrotask(()=>callback(incoming));
    return request;
  });
  return drained;
}

test('transporte HTTPS aceita 304, 204, 205 e HEAD sem corpo e conserva o corpo de 200',async t=>{
  const drained=replies(t,[
    {status:304,headers:{etag:'"cached"'},check:options=>assert.equal(options.headers['If-None-Match'],'"cached"')},
    {status:204},{status:205},{status:200},{status:200,body:'{"ok":true}'},
  ]);
  const address='https://93.184.216.34/metadata'; // O transporte é simulado; nenhuma conexão é aberta.
  const cached=await remote(address,{acceptStatuses:[304],headers:{'If-None-Match':'"cached"'}});
  assert.equal(cached.status,304);assert.equal(cached.body,null);assert.equal(cached.headers.get('etag'),'"cached"');
  for(const status of [204,205]) {const response=await remote(address);assert.equal(response.status,status);assert.equal(response.body,null);}
  assert.equal((await remote(address,{method:'HEAD'})).body,null);
  assert.equal(await smallBody(await remote(address)),'{"ok":true}');
  await Promise.all(drained);
});

test('resposta inválida rejeita a consulta em vez de lançar exceção fora da Promise',async t=>{
  replies(t,[{status:999}]);
  await assert.rejects(remote('https://93.184.216.34/metadata'),RangeError);
});

test('consulta de atualização com ETag e 304 atravessa o transporte real sem encerrar a aplicação',async t=>{
  replies(t,[{status:200,headers:{etag:'"release"'},body:JSON.stringify({tag_name:'v0.1.1',assets:[]})},
    {status:304,check:options=>assert.equal(options.headers['If-None-Match'],'"release"')}]);
  const root=await fixture();let manager,now=100000;
  try {
    manager=await new UpdateManager(root,{autoCheck:false,now:()=>now}).init();
    await manager.check({manual:true});now+=60001;
    const state=await manager.check({manual:true});
    assert.equal(state.checkError,'');assert.equal(state.hasRelease,true);assert.equal(state.checking,false);
  } finally {manager?.close();await cleanFixture(root);}
});
