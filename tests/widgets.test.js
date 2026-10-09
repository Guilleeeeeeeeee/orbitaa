import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.js';
import {madridMoment} from '../worker/notifications.js';
function environment(){
  const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  const statement=(sql,args=[])=>({async first(){return db.prepare(sql).get(...args)||null;},async run(){return {meta:{changes:db.prepare(sql).run(...args).changes}};},bind(...values){return statement(sql,values);}});
  return {ORBITA_PASSWORD:'long-password-for-widget-tests',DB:{prepare:statement}};
}
const origin='https://jp7.test';
async function login(env){const result=await worker.fetch(new Request(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:env.ORBITA_PASSWORD})}),env);return result.headers.get('Set-Cookie').split(';')[0];}
function req(path,method='GET',headers={},body){return new Request(origin+'/api/widget/'+path,{method,headers,...(body?{body:JSON.stringify(body)}:{})});}
test('widget pairing needs private login and same-origin; keys are revocable and limited to today tasks',async()=>{
  const env=environment(),day=madridMoment().day;
  const state={places:[],habits:[{id:'h1',name:'Private habit',days:[]}],entries:[{text:'Private diary'}],tasks:[{id:'today',title:'Today task',due:day,done:false,priority:'normal'},{id:'later',title:'Not today',due:'2099-01-01',done:false},{id:'none',title:'No date',due:'',done:false}]};
  await env.DB.prepare('INSERT INTO app_state (id,data,revision) VALUES (1,?,7)').bind(JSON.stringify(state)).run();
  assert.equal((await worker.fetch(req('token','POST',{Origin:origin}),env)).status,401);
  const cookie=await login(env);
  assert.equal((await worker.fetch(req('token','POST',{Origin:'https://evil.test',Cookie:cookie}),env)).status,403);
  const pair=await worker.fetch(req('token','POST',{Origin:origin,Cookie:cookie}),env),{token}=await pair.json();assert.match(token,/^[a-f0-9]{64}$/);
  assert.equal((await worker.fetch(req('today'),env)).status,401);
  const auth={Authorization:'Bearer '+token};
  const today=await(await worker.fetch(req('today','GET',auth),env)).json();assert.deepEqual(today.tasks,[{id:'today',title:'Today task',priority:'normal'}]);assert.equal(today.pending,1);assert.doesNotMatch(JSON.stringify(today),/Private|No date|Not today/);
  assert.equal((await worker.fetch(req('complete','POST',auth,{id:'later'}),env)).status,404);
  assert.equal((await worker.fetch(req('complete','GET',auth),env)).status,405);
  for(let i=0;i<2;i++)assert.equal((await worker.fetch(req('complete','POST',auth,{id:'today'}),env)).status,200);
  const saved=await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first();assert.equal(saved.revision,8);
  const changed=JSON.parse(saved.data);assert.equal(changed.tasks[0].done,true);assert.deepEqual(changed.habits,state.habits);assert.deepEqual(changed.entries,state.entries);assert.deepEqual(changed.tasks.slice(1),state.tasks.slice(1));
  assert.equal((await(await worker.fetch(req('today','GET',auth),env)).json()).pending,0);
  assert.equal((await worker.fetch(new Request(origin+'/api/state',{headers:auth}),env)).status,401);
  await worker.fetch(req('token','DELETE',{Origin:origin,Cookie:cookie}),env);
  assert.equal((await worker.fetch(req('today','GET',auth),env)).status,401);
});
test('new widget key replaces old key and password changes invalidate the connection',async()=>{
  const env=environment(),cookie=await login(env),headers={Origin:origin,Cookie:cookie};
  const first=await(await worker.fetch(req('token','POST',headers),env)).json();
  const second=await(await worker.fetch(req('token','POST',headers),env)).json();
  assert.equal((await worker.fetch(req('today','GET',{Authorization:'Bearer '+first.token}),env)).status,401);
  assert.equal((await worker.fetch(req('today','GET',{Authorization:'Bearer '+second.token}),env)).status,200);
  env.ORBITA_PASSWORD='a-new-private-password';
  assert.equal((await worker.fetch(req('today','GET',{Authorization:'Bearer '+second.token}),env)).status,401);
});

test('habit widgets mark and unmark today idempotently without editing history or other app data',async()=>{
  const env=environment(),day=madridMoment().day;
  const state={places:[],habits:[{id:'gym',name:'Gym',icon:'dumbbell',days:['2020-01-01']}],entries:[{text:'Private diary'}],tasks:[{id:'task',title:'Private task',due:day,done:false}]};
  await env.DB.prepare('INSERT INTO app_state (id,data,revision) VALUES (1,?,1)').bind(JSON.stringify(state)).run();
  assert.equal((await worker.fetch(req('habits'),env)).status,401);
  assert.equal((await worker.fetch(req('habit','POST',{}, {id:'gym',day,done:true}),env)).status,401);
  const cookie=await login(env),{token}=await(await worker.fetch(req('token','POST',{Origin:origin,Cookie:cookie}),env)).json(),auth={Authorization:'Bearer '+token};
  const summary=await(await worker.fetch(req('habits','GET',auth),env)).json();
  assert.deepEqual(summary,{day,habits:[{id:'gym',name:'Gym',icon:'dumbbell',done:false}],completed:0,total:1});
  assert.doesNotMatch(JSON.stringify(summary),/2020-01-01|Private/);
  assert.equal((await worker.fetch(req('habit','POST',auth,{id:'gym',day:'2000-01-01',done:true}),env)).status,409);
  assert.equal((await worker.fetch(req('habit','POST',auth,{id:'gym',day,done:'true'}),env)).status,400);
  assert.equal((await worker.fetch(req('habit','POST',auth,{id:'missing',day,done:true}),env)).status,404);
  for(let i=0;i<2;i++)assert.equal((await worker.fetch(req('habit','POST',auth,{id:'gym',day,done:true}),env)).status,200);
  let saved=await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first();
  assert.equal(saved.revision,2);assert.deepEqual(JSON.parse(saved.data).habits[0].days,['2020-01-01',day]);
  assert.equal((await(await worker.fetch(req('habits','GET',auth),env)).json()).completed,1);
  for(let i=0;i<2;i++)assert.equal((await worker.fetch(req('habit','POST',auth,{id:'gym',day,done:false}),env)).status,200);
  saved=await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first();
  assert.equal(saved.revision,3);assert.deepEqual(JSON.parse(saved.data),state);
  await worker.fetch(req('token','DELETE',{Origin:origin,Cookie:cookie}),env);
  assert.equal((await worker.fetch(req('habits','GET',auth),env)).status,401);
  assert.equal((await worker.fetch(req('habit','POST',auth,{id:'gym',day,done:true}),env)).status,401);
});
