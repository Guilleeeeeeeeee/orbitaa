import {madridMoment} from './notifications.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function table(env){await env.DB.prepare('CREATE TABLE IF NOT EXISTS widget_access (id INTEGER PRIMARY KEY CHECK(id = 1), digest TEXT NOT NULL, expires INTEGER NOT NULL)').run();}
async function digest(token,secret){const enc=new TextEncoder();const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(token)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
// Called only after the normal session and origin checks.
export async function widgetToken(request,env){
  await table(env);
  if(request.method==='DELETE'){await env.DB.prepare('DELETE FROM widget_access WHERE id = 1').run();return json({ok:true});}
  if(request.method!=='POST')return json({error:'Método no permitido.'},405);
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const expires=Date.now()+365*86400000;
  await env.DB.prepare('INSERT INTO widget_access (id,digest,expires) VALUES (1,?,?) ON CONFLICT(id) DO UPDATE SET digest=excluded.digest,expires=excluded.expires').bind(await digest(token,env.ORBITA_PASSWORD),expires).run();
  return json({token,expires});
}
export async function widgetApi(request,env){
  const path=new URL(request.url).pathname;
  if(!['/api/widget/today','/api/widget/complete'].includes(path))return json({error:'No encontrado.'},404);
  const token=(request.headers.get('Authorization')||'').match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if(!token||typeof env.ORBITA_PASSWORD!=='string'||env.ORBITA_PASSWORD.length<16)return json({error:'Vuelve a conectar el widget desde JP7.'},401);
  await table(env);
  const access=await env.DB.prepare('SELECT digest,expires FROM widget_access WHERE id = 1').first();
  if(!access||access.expires<=Date.now())return json({error:'Vuelve a conectar el widget desde JP7.'},401);
  const expected=await digest(token,env.ORBITA_PASSWORD);let difference=0;for(let i=0;i<expected.length;i++)difference|=expected.charCodeAt(i)^access.digest.charCodeAt(i);
  if(difference||expected.length!==access.digest.length)return json({error:'Vuelve a conectar el widget desde JP7.'},401);
  const day=madridMoment().day;
  if(path==='/api/widget/today'&&request.method==='GET'){
    const row=await env.DB.prepare('SELECT data FROM app_state WHERE id = 1').first();
    const tasks=(row?JSON.parse(row.data).tasks:[]).filter(t=>!t.done&&t.due===day).sort((a,b)=>Number(b.priority==='high')-Number(a.priority==='high')).map(({id,title,priority})=>({id,title,priority}));
    return json({day,tasks,pending:tasks.length,updatedAt:new Date().toISOString()});
  }
  if(path==='/api/widget/complete'&&request.method==='POST'){
    const raw=await request.text();if(raw.length>300)return json({error:'Datos no válidos.'},400);
    let body;try{body=JSON.parse(raw);}catch{return json({error:'Datos no válidos.'},400);}
    if(typeof body.id!=='string'||! /^[A-Za-z0-9_-]{1,100}$/.test(body.id))return json({error:'Datos no válidos.'},400);
    for(let attempt=0;attempt<4;attempt++){
      const row=await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first();
      const state=row?JSON.parse(row.data):null,task=state?.tasks.find(t=>t.id===body.id);
      if(!task||task.due!==day)return json({error:'Esta tarea ya no está en la lista de hoy.'},404);
      if(task.done)return json({ok:true});
      task.done=true;
      const result=await env.DB.prepare('UPDATE app_state SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(JSON.stringify(state),row.revision).run();
      if(result.meta.changes)return json({ok:true});
    }
    return json({error:'Hay otros cambios guardándose. Vuelve a intentarlo.'},409);
  }
  return json({error:'Método no permitido.'},405);
}
