import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {MessageChannel} from 'node:worker_threads';
const script=readFileSync(new URL('../scripts/sw-push.js',import.meta.url),'utf8');
async function click(clients,url='https://jp7.test/#2323-now'){
  const handlers={},opened=[];
  const self={location:{origin:'https://jp7.test'},clients:{matchAll:async()=>clients,openWindow:async url=>opened.push(url)},addEventListener(name,fn){handlers[name]=fn;}};
  runInNewContext(script,{self,URL,MessageChannel,setTimeout,clearTimeout});
  let pending,closed=false;
  handlers.notificationclick({notification:{data:{url},close(){closed=true;}},waitUntil(p){pending=p;}});
  await pending;assert.equal(closed,true);return opened;
}
test('running app receives notification action and acknowledges without navigation',async()=>{
  let focused=0,navigated=0,message;
  const opened=await click([{url:'https://jp7.test/#journal',async focus(){focused++;},async navigate(){navigated++;},postMessage(data,ports){message=data;ports[0].postMessage({opened:true});ports[0].close();}}]);
  assert.equal(focused,1);assert.equal(navigated,0);assert.equal(message.type,'JP7_OPEN_MOMENT');assert.equal(message.url,'https://jp7.test/#2323-now');assert.equal(opened.length,0);
});
test('older app that cannot handle the message falls back to the notification URL',async()=>{
  let navigated;
  await click([{url:'https://jp7.test/#habits',async focus(){},async navigate(url){navigated=url;},postMessage(data,ports){ports[0].postMessage({opened:false});ports[0].close();}}]);
  assert.equal(navigated,'https://jp7.test/#2323-now');
});
test('closed app opens the alert URL and cross-origin links are constrained to JP7',async()=>{
  assert.deepEqual(await click([]),['https://jp7.test/#2323-now']);
  assert.deepEqual(await click([],'https://evil.test/#2323'),['https://jp7.test/#2323']);
});
