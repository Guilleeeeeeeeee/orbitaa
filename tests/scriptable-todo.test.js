import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../public/jp7-todo.js',import.meta.url),'utf8');
async function run(complete){
  const nodes=[],requests=[];let tasks=[{id:'task_1',title:'Ejercicios SW',priority:'high'},{id:'task_2',title:'Acabar la app',priority:'normal'}];
  class Stack{constructor(){nodes.push(this);}addText(value){const node={value};nodes.push(node);return node;}addImage(){return {};}addStack(){return new Stack();}addSpacer(){}layoutHorizontally(){}layoutVertically(){}centerAlignContent(){}setPadding(){}async presentMedium(){}}
  class Request{constructor(url){this.url=url;this.response={statusCode:200};}async loadJSON(){requests.push(this);assert.equal(this.headers.Authorization,'Bearer '+'a'.repeat(64));if(this.url.endsWith('/complete')){tasks=tasks.filter(t=>t.id!==JSON.parse(this.body).id);return {ok:true};}return {tasks,pending:tasks.length};}}
  class Color{static white(){return new Color();}};
  await runInNewContext('(async()=>{'+source+'})()',{
    args:{queryParameters:complete?{complete}:{}},config:{runsInWidget:!complete},
    Request,Color,ListWidget:Stack,LinearGradient:class{},Size:class{},
    Keychain:{contains:()=>true,get:()=>'a'.repeat(64)},
    Font:{systemFont:()=>({}),boldSystemFont:()=>({})},
    SFSymbol:{named:()=>({applyFont(){},image:{}})},
    URLScheme:{forRunningScript:()=> 'scriptable:///run?scriptName=JP7%20ToDo'},
    Script:{setWidget(){},complete(){}}
  });
  return {nodes,requests};
}
test('Scriptable widget renders today tasks with independent completion links and count',async()=>{
  const {nodes,requests}=await run();assert.equal(requests.length,1);
  assert.ok(nodes.some(n=>n.value==='Ejercicios SW'));assert.ok(nodes.some(n=>n.value==='2'));
  assert.ok(nodes.some(n=>n.url==='scriptable:///run?scriptName=JP7%20ToDo&complete=task_1'));
  assert.ok(nodes.some(n=>n.url==='scriptable:///run?scriptName=JP7%20ToDo&complete=task_2'));
  assert.ok(!nodes.some(n=>n.url?.includes('aaaa')));
});
test('tapping task completes it before retrieving fresh data and rendering the remaining task',async()=>{
  const {nodes,requests}=await run('task_1');assert.equal(requests[0].method,'POST');assert.equal(requests[0].body,'{"id":"task_1"}');assert.ok(requests[1].url.endsWith('/today'));
  assert.ok(nodes.some(n=>n.value==='1'));assert.ok(!nodes.some(n=>n.value==='Ejercicios SW'));assert.ok(nodes.some(n=>n.value==='Acabar la app'));
});
