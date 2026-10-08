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
