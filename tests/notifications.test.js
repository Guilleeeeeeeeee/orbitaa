import test from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,randomBytes,hkdfSync,createDecipheriv,createPublicKey,verify} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {generateVapid,encryptPayload,sendPush,validSubscription,encode64} from '../worker/web-push.js';
import {madridMoment,getVapid,sendDaily,pushApi,sendEveningPreview} from '../worker/notifications.js';
import worker from '../worker/index.js';
function receiver(){const key=createECDH('prime256v1');key.generateKeys();const auth=randomBytes(16);return {key,auth,subscription:{endpoint:'https://web.push.apple.com/test-endpoint',keys:{p256dh:encode64(key.getPublicKey()),auth:encode64(auth)}}};}
function environment(){
  const db=new DatabaseSync(':memory:');
  for(const file of ['0001_initial.sql','0002_push.sql'])db.exec(readFileSync(new URL('../migrations/'+file,import.meta.url),'utf8'));
  const statement=(sql,args=[])=>({
    async first(){return db.prepare(sql).get(...args)||null;},
    async all(){return {results:db.prepare(sql).all(...args)};},
    async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}};},
    bind(...values){return statement(sql,values);}
  });
  return {ORBITA_PASSWORD:'long-password-for-tests-only',DB:{prepare:statement}};
}
test('push encryption decrypts independently with Node crypto and the receiver private key',async()=>{
  const {key,auth,subscription}=receiver(),payload={title:'SON LAS 23:23!!!',body:'Toca para ver el cartel.'};
  const packet=Buffer.from(await encryptPayload(subscription,payload));assert.equal(packet.readUInt32BE(16),4096);assert.equal(packet[20],65);
  const salt=packet.subarray(0,16),sender=packet.subarray(21,86),shared=key.computeSecret(sender);
  const input=hkdfSync('sha256',shared,auth,Buffer.concat([Buffer.from('WebPush: info\0'),key.getPublicKey(),sender]),32);
  const cek=hkdfSync('sha256',input,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16),nonce=hkdfSync('sha256',input,salt,Buffer.from('Content-Encoding: nonce\0'),12);
  const ciphertext=packet.subarray(86),decipher=createDecipheriv('aes-128-gcm',cek,nonce);decipher.setAuthTag(ciphertext.subarray(-16));
  const plaintext=Buffer.concat([decipher.update(ciphertext.subarray(0,-16)),decipher.final()]);assert.equal(plaintext.at(-1),2);assert.deepEqual(JSON.parse(plaintext.subarray(0,-1)),payload);
});
test('VAPID request has a valid signature, correct audience, short TTL and no redirect following',async()=>{
  const {subscription}=receiver(),vapid=await generateVapid();let request;
  await sendPush(subscription,vapid,{title:'JP7'},'https://jp7.test',async(url,options)=>{request={url,...options};return new Response(null,{status:201});});
  const jwt=request.headers.Authorization.match(/t=([^,]+)/)[1];const [header,claims,signature]=jwt.split('.');
  const publicKey=createPublicKey({key:{...vapid.privateKey,d:undefined,key_ops:['verify']},format:'jwk'});
  assert.ok(verify('sha256',Buffer.from(header+'.'+claims),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')));
  assert.equal(JSON.parse(Buffer.from(claims,'base64url')).aud,'https://web.push.apple.com');assert.equal(request.headers.TTL,'60');assert.equal(request.redirect,'manual');
});
test('subscription validation blocks arbitrary destinations and malformed encryption keys',()=>{
  const {subscription}=receiver();assert.ok(validSubscription(subscription));for(const endpoint of ['http://web.push.apple.com/x','https://web.push.apple.com.evil.test/x','https://127.0.0.1/x','https://user@web.push.apple.com/x','https://web.push.apple.com:8443/x'])assert.equal(validSubscription({...subscription,endpoint}),false);assert.equal(validSubscription({...subscription,keys:{...subscription.keys,auth:'bad'}}),false);
});
test('daily schedule follows Madrid summer/winter time and skips other hours',()=>{
  assert.deepEqual(madridMoment(new Date('2026-10-06T21:23:00Z')),{day:'2026-10-06',time:'23:23'});
  assert.deepEqual(madridMoment(new Date('2026-12-06T22:23:00Z')),{day:'2026-12-06',time:'23:23'});
  assert.equal(madridMoment(new Date('2026-10-06T22:23:00Z')).time,'00:23');
});
test('push endpoints require login; persistent keys expose only their public half',async()=>{
  const env=environment();assert.equal((await worker.fetch(new Request('https://jp7.test/api/push/config'),env)).status,401);
  const first=await getVapid(env),second=await getVapid(env);assert.deepEqual(second,first);
  const data=await(await pushApi(new Request('https://jp7.test/api/push/config'),env)).json();assert.equal(data.publicKey,first.publicKey);assert.equal(data.privateKey,undefined);
});
test('devices opt in separately; duplicate jobs send once and expired subscriptions are removed',async()=>{
  const env=environment(),{subscription}=receiver(),request=(method,body)=>new Request('https://jp7.test/api/push/subscribe',{method,body:JSON.stringify(body)});
  assert.equal((await pushApi(request('POST',subscription),env)).status,200);
  const time=new Date('2026-10-06T21:23:00Z');let sends=0;const fetcher=async()=>{sends++;return new Response(null,{status:201});};
  await sendDaily(env,time,fetcher,time);await sendDaily(env,time,fetcher,time);assert.equal(sends,1);
  // Reopening settings or re-registering the same endpoint must not reset deduplication.
  await pushApi(request('POST',subscription),env);await sendDaily(env,time,fetcher,time);assert.equal(sends,1);
  const next=new Date('2026-10-07T21:23:00Z');await sendDaily(env,next,fetcher,new Date('2026-10-07T21:24:00Z'));assert.equal(sends,1);
  await sendDaily(env,next,async()=>new Response(null,{status:410}),next);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first()).count,0);
  await pushApi(request('POST',subscription),env);await pushApi(request('DELETE',{endpoint:subscription.endpoint}),env);assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first()).count,0);
});

test('17:35 preview sends once on the requested date and preserves the nightly notification',async()=>{
  const env=environment(),{subscription}=receiver();
  await pushApi(new Request('https://jp7.test/api/push/subscribe',{method:'POST',body:JSON.stringify(subscription)}),env);
  let sends=0;const fetcher=async()=>{sends++;return new Response(null,{status:201});};
  const time=new Date('2026-10-09T15:35:00Z');
  await sendEveningPreview(env,time,fetcher,time);await sendEveningPreview(env,time,fetcher,time);assert.equal(sends,1);
  const tomorrow=new Date('2026-10-10T15:35:00Z');await sendEveningPreview(env,tomorrow,fetcher,tomorrow);assert.equal(sends,1);
  const night=new Date('2026-10-09T21:23:00Z');await sendDaily(env,night,fetcher,night);assert.equal(sends,2);
});

test('missing push tables are created without changing personal state',async()=>{
  const env=environment();
  await env.DB.prepare('DROP TABLE push_subscriptions').run();await env.DB.prepare('DROP TABLE push_config').run();
  await env.DB.prepare("INSERT INTO app_state (id,data,revision) VALUES (1,'private-state',7)").run();
  const config=await pushApi(new Request('https://jp7.test/api/push/config'),env);assert.equal(config.status,200);
  assert.equal((await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first()).data,'private-state');assert.equal((await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first()).revision,7);
  assert.equal((await env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first()).count,0);
});

test('test failures distinguish provider rejection from transport failure without exposing subscription data',async()=>{
  const env=environment(),{subscription}=receiver();
  const req=path=>new Request('https://jp7.test/api/push/'+path,{method:'POST',body:JSON.stringify(subscription)});
  await pushApi(req('subscribe'),env);
  const rejected=await pushApi(req('test'),env,async()=>Response.json({reason:'BadJwtToken'},{status:403}));
  assert.equal(rejected.status,502);assert.equal((await rejected.json()).code,'PUSH_PROVIDER_403_BadJwtToken');
  await env.DB.prepare('UPDATE push_subscriptions SET last_test = 0').run();
  const transport=await pushApi(req('test'),env,async()=>{throw Error('secret endpoint should not appear');});
  const data=await transport.json();assert.equal(data.code,'PUSH_TRANSPORT');assert.doesNotMatch(JSON.stringify(data),/secret endpoint/);
});


test('signing and encryption failures are identified before any network request',async()=>{
  const env=environment(),{subscription}=receiver();
  const req=body=>new Request('https://jp7.test/api/push/test',{method:'POST',body:JSON.stringify(body)});
  await pushApi(new Request('https://jp7.test/api/push/subscribe',{method:'POST',body:JSON.stringify(subscription)}),env);
  const vapid=await getVapid(env);
  await env.DB.prepare('UPDATE push_config SET data = ? WHERE id = 1').bind(JSON.stringify({...vapid,privateKey:{}})).run();
  let calls=0;const fetcher=async()=>{calls++;return new Response(null,{status:201});};
  const auth=await pushApi(req(subscription),env,fetcher);
  assert.equal((await auth.json()).code,'PUSH_AUTH');assert.equal(calls,0);
  await env.DB.prepare('UPDATE push_config SET data = ? WHERE id = 1').bind(JSON.stringify(vapid)).run();
  await env.DB.prepare('UPDATE push_subscriptions SET last_test = 0').run();
  // A correctly sized but off-curve point passes the shape check and fails import.
  const point=new Uint8Array(65);point[0]=4;
  const invalid={...subscription,keys:{...subscription.keys,p256dh:encode64(point)}};
  assert.ok(validSubscription(invalid));
  const encryption=await pushApi(req(invalid),env,fetcher);
  const data=await encryption.json();assert.equal(data.code,'PUSH_ENCRYPTION');assert.equal(calls,0);
  assert.doesNotMatch(JSON.stringify(data),/test-endpoint|privateKey|p256dh/);
});
