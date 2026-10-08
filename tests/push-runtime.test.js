import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('push delivery uses the real Workers fetch API and never follows redirects',async()=>{
  const bundled=await build({stdin:{contents:`
    import {generateVapid,sendPush,encode64} from './worker/web-push.js';
    export default {async fetch(request){
      try{
        const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
        const subscription={endpoint:'https://web.push.apple.com/'+new URL(request.url).pathname.slice(1),keys:{p256dh:encode64(await crypto.subtle.exportKey('raw',keys.publicKey)),auth:encode64(crypto.getRandomValues(new Uint8Array(16)))}};
        const result=await sendPush(subscription,await generateVapid(),{title:'JP7'},'https://jp7.test');
        return Response.json({status:result.status});
      }catch(error){return Response.json({error:error.name,stage:error.stage});}
    }};`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm'});
  const destinations=[];
  const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundled.outputFiles[0].text,compatibilityDate:'2026-10-01',outboundService:async request=>{
    destinations.push(request.url);
    assert.equal(request.method,'POST');
    assert.ok(request.headers.get('Authorization').startsWith('vapid t='));
    assert.ok((await request.arrayBuffer()).byteLength>86);
    return request.url.endsWith('/redirect')?new Response(null,{status:307,headers:{Location:'https://example.com/must-not-follow'}}):new Response(null,{status:201});
  }}));
  try{
    assert.deepEqual(await(await mf.dispatchFetch('http://localhost/accepted')).json(),{status:201});
    assert.deepEqual(await(await mf.dispatchFetch('http://localhost/redirect')).json(),{status:307});
    assert.deepEqual(destinations,['https://web.push.apple.com/accepted','https://web.push.apple.com/redirect']);
  }finally{await mf.dispose();}
});
