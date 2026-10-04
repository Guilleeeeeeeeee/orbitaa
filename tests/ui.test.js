import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const tick=()=>new Promise(resolve=>setTimeout(resolve,15));
test('five views work; habits, tasks, journal and places can be created and completed in demo',async()=>{
 const bundle=await build({entryPoints:['src/main.js'],bundle:true,write:false,format:'iife',define:{'import.meta.env.PROD':'false'},plugins:[{name:'test-surface',setup(b){b.onResolve({filter:/\.css$/},()=>({path:'style',namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:''}));b.onResolve({filter:/\.\/globe.js$/},()=>({path:'globe',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const createGlobe=()=>({dispose(){},zoom(){},reset(){},focus(){}})'}));}}]});
 const dom=new JSDOM('<div id="app"></div><div id="toast"></div><dialog id="dialog"></dialog>',{url:'https://orbita.test',runScripts:'outside-only'});const w=dom.window;
 w.structuredClone=structuredClone;w.fetch=async()=>({ok:true,json:async()=>({configured:false,authenticated:false})});w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 w.eval(bundle.outputFiles[0].text);await tick();const click=s=>{const el=w.document.querySelector(s);assert.ok(el,s);el.click();};
 click('[data-action="demo"]');assert.equal(w.document.querySelectorAll('.sidebar [data-tab]').length,5);assert.match(w.document.body.textContent,/Vista de prueba/);
 click('[data-tab="habits"]');click('[data-toggle-habit]');await tick();assert.ok(w.document.querySelector('.check-button.checked'));
 click('[data-tab="tasks"]');click('[data-action="add-task"]');w.document.querySelector('[name="title"]').value='Preparar clase';click('dialog [type="submit"]');await tick();assert.match(w.document.querySelector('.task-title').textContent,/Preparar clase/);click('[data-toggle-task]');await tick();click('[data-filter="done"]');assert.ok(w.document.querySelector('.completed'));
 click('[data-tab="journal"]');click('[data-action="add-entry"]');w.document.querySelector('[name="text"]').value='<img src=x onerror=alert(1)> Un buen día';click('dialog [type="submit"]');await tick();assert.match(w.document.querySelector('.journal-card>p').textContent,/<img/);assert.equal(w.document.querySelectorAll('.journal-card img').length,0);
 click('[data-tab="world"]');click('[data-action="add-place"]');for(const [n,v]of Object.entries({name:'Lisboa',country:'Portugal',lat:'38.72',lng:'-9.14'}))w.document.querySelector(`[name="${n}"]`).value=v;click('dialog [type="submit"]');await tick();assert.match(w.document.querySelector('.place-list').textContent,/Lisboa/);
 click('[data-tab="summary"]');assert.equal(w.document.querySelectorAll('.summary-stat').length,4);assert.equal(w.document.querySelectorAll('.bar-column').length,7);dom.window.close();
});
