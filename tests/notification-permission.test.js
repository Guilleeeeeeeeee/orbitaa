import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

test('installed iPhone can request permission while registration is missing, without a global PushManager',async()=>{
  const bundle=await build({entryPoints:['src/notifications.js'],bundle:true,write:false,format:'iife',globalName:'JP7Notifications'});
  const dom=new JSDOM('<div id="settings"></div>',{url:'https://jp7.test',runScripts:'outside-only'}),w=dom.window;
  Object.defineProperty(w.navigator,'userAgent',{value:'iPhone'});w.navigator.standalone=true;
  let requested=false;
  w.Notification={permission:'default',requestPermission(){requested=true;w.Notification.permission='denied';return Promise.resolve('denied');}};
  Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistration:async()=>null}});
  w.eval(bundle.outputFiles[0].text);const notifications=w.JP7Notifications;
  w.document.querySelector('#settings').innerHTML=notifications.notificationSettings();
  await notifications.updateNotificationSettings();
  const button=w.document.querySelector('[data-action="push-enable"]');assert.equal(button.disabled,false);assert.equal(button.textContent,'Permitir notificaciones');
  const action=notifications.notificationAction('push-enable');assert.equal(requested,true,'permission is requested before waiting on service-worker or network');await action;
  assert.equal(button.disabled,true);assert.match(w.document.querySelector('#push-status').textContent,/permitido/);
  w.Notification.permission='default';
  w.navigator.serviceWorker.getRegistration=async()=>({pushManager:{getSubscription:async()=>null}});
  await notifications.updateNotificationSettings();assert.equal(button.disabled,false);
  w.navigator.standalone=false;await notifications.updateNotificationSettings();assert.equal(button.disabled,true);assert.match(w.document.querySelector('#push-status').textContent,/pantalla de inicio/);
  dom.window.close();
});

test('the final notification link opens the full minute without a test label',async()=>{
  const bundle=await build({entryPoints:['src/notifications.js'],bundle:true,write:false,format:'iife',globalName:'JP7Notifications'});
  const dom=new JSDOM('',{url:'https://jp7.test/#2323-now',runScripts:'outside-only'}),w=dom.window;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
  w.eval(bundle.outputFiles[0].text);w.JP7Notifications.openMomentLink();
  assert.ok(w.document.querySelector('#jp7-moment').open);
  assert.equal(w.document.querySelector('.led-panel').getAttribute('aria-label'),'SON LAS 23:23!!!');
  assert.match(w.document.querySelector('.moment-countdown').textContent,/60 segundos/);
  assert.doesNotMatch(w.document.body.textContent,/VISTA PREVIA|vista previa|terminado/);
  w.document.querySelector('.moment-close').click();dom.window.close();
});

test('existing iPhone permission re-registers on the server before requesting the real alert',async()=>{
  const bundle=await build({entryPoints:['src/notifications.js'],bundle:true,write:false,format:'iife',globalName:'JP7Notifications'});
  const dom=new JSDOM('<div id="settings"></div>',{url:'https://jp7.test',runScripts:'outside-only'}),w=dom.window;
  Object.defineProperty(w.navigator,'userAgent',{value:'iPhone'});w.navigator.standalone=true;w.Notification={permission:'granted'};
  const current={toJSON:()=>({endpoint:'device'})};
  Object.defineProperty(w.navigator,'serviceWorker',{value:{getRegistration:async()=>({pushManager:{getSubscription:async()=>current}})}});
  const calls=[];let reject=false;
  w.fetch=async(url,options)=>{calls.push(url);return {ok:!reject,json:async()=>reject?{error:'No se ha podido entregar el aviso (PUSH_PROVIDER_403).'}:{ok:true}};};
  w.eval(bundle.outputFiles[0].text);const n=w.JP7Notifications;
  w.document.querySelector('#settings').innerHTML=n.notificationSettings();
  await n.updateNotificationSettings();assert.deepEqual(calls,['/api/push/subscribe','/api/push/real-preview']);
  assert.equal(w.document.querySelector('#push-status').hidden,true);
  reject=true;await n.updateNotificationSettings();
  assert.equal(w.document.querySelector('#push-status').hidden,false);assert.match(w.document.querySelector('#push-status').textContent,/PUSH_PROVIDER_403/);
  dom.window.close();
});
