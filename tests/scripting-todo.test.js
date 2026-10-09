import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import vm from 'node:vm';

const root=new URL('../widgets/scripting/',import.meta.url).pathname;
const token='a'.repeat(64),key='jp7-todo-token-v1';
async function runtime(entry,extra='',options={}){
  const stored=new Map(options.noToken?[]:[[key,token]]),storage=new Map(),calls=[],intents=new Map(),alerts=[];let rendered,reloads=0,previews=0;
  const api={
    Keychain:{get:k=>stored.get(k)??null,set:(k,v)=>{stored.set(k,v);return true;},remove:k=>stored.delete(k)},
    Storage:{get:k=>storage.get(k)??null,set:(k,v)=>storage.set(k,v),remove:k=>storage.delete(k)},
    AppIntentProtocol:{AppIntent:'background'},AppIntentManager:{register:def=>{intents.set(def.name,def);return params=>({name:def.name,params});}},
    Widget:{reloadAll:()=>reloads++,present:node=>rendered=node,preview:async()=>previews++},
    Dialog:{prompt:async()=>options.prompt===null?null:token,alert:async value=>alerts.push(value)},Script:{exit:()=>{}},
    Button:'Button',HStack:'HStack',VStack:'VStack',Text:'Text',Image:'Image',Spacer:'Spacer',Link:'Link',
  };
  const source=readFileSync(root+entry,'utf8')+'\n'+extra;
  const result=await build({stdin:{contents:source,resolveDir:root,sourcefile:entry,loader:entry.endsWith('tsx')?'tsx':'ts'},bundle:true,write:false,format:'iife',jsxFactory:'__jsx',plugins:[{name:'scripting-mock',setup(b){b.onResolve({filter:/^scripting$/},()=>({path:'scripting',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const {Keychain,Storage,AppIntentProtocol,AppIntentManager,Widget,Button,HStack,VStack,Text,Image,Spacer,Link,Dialog,Script}=globalThis.api;'}));}}]});
  const context=vm.createContext({api,console,Date,Error,JSON,globalThis:null,__jsx:(type,props,...children)=>typeof type==='function'?type({...props,children}):({type,props:props||{},children}),fetch:async(url,init)=>{calls.push({url,init});return options.fetch?options.fetch(url,init):{ok:true,status:200,json:async()=>({day:'2026-10-09',pending:1,tasks:[{id:'task_1',title:'Probar JP7',priority:'high'}]})};}});
  context.globalThis=context;
  new vm.Script(result.outputFiles[0].text).runInContext(context);
  await new Promise(resolve=>setImmediate(resolve));
  return {stored,storage,calls,intents,alerts,get previews(){return previews;},get rendered(){return rendered;},get reloads(){return reloads;},context};
}
function nodes(node,type){if(!node||typeof node!=='object')return [];if(Array.isArray(node))return node.flatMap(x=>nodes(x,type));return [...(node.type===type?[node]:[]),...nodes(node.children,type)];}

test('Scripting widget renders native completion intents without putting the key in links or parameters',async()=>{
  const r=await runtime('widget.tsx');
  const complete=nodes(r.rendered,'Button').find(b=>b.props.intent.name==='JP7CompleteTask');
  assert.equal(complete.props.intent.params.id,'task_1');
  assert.equal(r.intents.get('JP7CompleteTask').protocol,'background');
  assert.equal(JSON.stringify(r.rendered).includes(token),false);
  assert.equal(nodes(r.rendered,'Link')[0].props.url,'https://orbitaa.guillestyle2.workers.dev/#tasks');
  await r.intents.get('JP7CompleteTask').perform({id:'task_1'});
  assert.equal(r.calls[1].init.method,'POST');
  assert.equal(r.calls[1].init.headers.Authorization,'Bearer '+token);
  assert.equal(r.calls[1].init.body,JSON.stringify({id:'task_1'}));
  assert.equal(r.reloads,1);
});
test('Scripting failed completion stays visible and requests reload without claiming success',async()=>{
  const r=await runtime('app_intents.tsx','',{fetch:async()=>({ok:false,status:503,json:async()=>({error:'No se ha guardado.'})})});
  await r.intents.get('JP7CompleteTask').perform({id:'task_1'});
  assert.equal(r.storage.get('jp7-todo-action-error-v1'),'No se ha guardado.');
  assert.equal(r.reloads,1);
});
test('Scripting missing or revoked key displays reconnection rather than zero pending',async()=>{
  const missing=await runtime('widget.tsx','',{noToken:true});
  assert.equal(missing.calls.length,0);
  assert.equal(nodes(missing.rendered,'Button').some(b=>b.props.intent.name==='JP7CompleteTask'),false);
  assert.match(JSON.stringify(missing.rendered),/conectar tu clave/);
  const revoked=await runtime('widget.tsx','',{fetch:async()=>({ok:false,status:401,json:async()=>({error:'Vuelve a conectar el widget desde JP7.'})})});
  assert.equal(revoked.stored.has(key),false);
  assert.match(JSON.stringify(revoked.rendered),/Vuelve a conectar/);
});
test('Scripting invalid task ids never send a completion request',async()=>{
  const r=await runtime('model.ts','completeTask("../bad").then(value=>globalThis.result=value);');
  assert.equal(r.context.result,false);
  assert.equal(r.calls.length,0);
});
test('Scripting setup validates the private widget key before saving and previewing',async()=>{
  const r=await runtime('index.tsx','',{noToken:true});
  assert.equal(r.stored.get(key),token);
  assert.equal(r.previews,1);
  assert.equal(r.calls.length,1);
  const rejected=await runtime('index.tsx','',{noToken:true,fetch:async()=>({ok:false,status:401,json:async()=>({error:'Clave no válida.'})})});
  assert.equal(rejected.stored.has(key),false);
  assert.equal(rejected.previews,0);
  assert.equal(rejected.alerts[0].message,'Clave no válida.');
  const canceled=await runtime('index.tsx','',{noToken:true,prompt:null});
  assert.equal(canceled.calls.length,0);
});
