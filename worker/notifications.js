import {generateVapid,validSubscription,sendPush} from './web-push.js';
const SITE='https://orbitaa.guillestyle2.workers.dev';
export function madridMoment(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function notificationPayload(origin=SITE,test=false){
  return {title:test?'JP7 · Prueba de las 23:23':'SON LAS 23:23!!!',body:test?'Así llegará el aviso de las 23:23. Toca para ver el cartel.':'Toca para ver el cartel.',icon:origin+'/jp7-chrome-192.png',tag:test?'jp7-2323-test':'jp7-2323',url:origin+'/#2323'+(test?'-test':''),test};
}
export async function getVapid(env){
  let row=await env.DB.prepare('SELECT data FROM push_config WHERE id = 1').first();
  if(!row){const pair=await generateVapid();await env.DB.prepare('INSERT OR IGNORE INTO push_config (id,data) VALUES (1,?)').bind(JSON.stringify(pair)).run();row=await env.DB.prepare('SELECT data FROM push_config WHERE id = 1').first();}
  return JSON.parse(row.data);
}
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function pushApi(request,env){
  const path=new URL(request.url).pathname;
  if(path==='/api/push/config'&&request.method==='GET')return response({publicKey:(await getVapid(env)).publicKey,time:'23:23',timezone:'Europe/Madrid'});
  if(!['/api/push/subscribe','/api/push/test'].includes(path))return response({error:'No encontrado.'},404);
  if(!['POST','DELETE'].includes(request.method))return response({error:'Método no permitido.'},405);
  if(path==='/api/push/test'&&request.method!=='POST')return response({error:'Método no permitido.'},405);
  const raw=await request.text();if(raw.length>4096)return response({error:'Datos demasiado grandes.'},413);
  let body;try{body=JSON.parse(raw);}catch{return response({error:'Datos no válidos.'},400);}
  if(path==='/api/push/subscribe'&&request.method==='DELETE'){
    if(typeof body.endpoint!=='string'||body.endpoint.length>2048)return response({error:'Datos no válidos.'},400);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run();return response({ok:true});
  }
  if(!validSubscription(body))return response({error:'La suscripción no es válida.'},400);
  if(path==='/api/push/subscribe'){
    const existing=await env.DB.prepare('SELECT endpoint FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).first();
    const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM push_subscriptions').first();
    if(!existing&&count.count>=20)return response({error:'Hay demasiados dispositivos registrados.'},429);
    const subscription={endpoint:body.endpoint,keys:{p256dh:body.keys.p256dh,auth:body.keys.auth}};
    await env.DB.prepare('INSERT INTO push_subscriptions (endpoint,data) VALUES (?,?) ON CONFLICT(endpoint) DO UPDATE SET data=excluded.data').bind(body.endpoint,JSON.stringify(subscription)).run();
    return response({ok:true});
  }
  const now=Date.now();
  const claim=await env.DB.prepare('UPDATE push_subscriptions SET last_test = ? WHERE endpoint = ? AND last_test < ?').bind(now,body.endpoint,now-30000).run();
  if(!claim.meta.changes)return response({error:'Activa el aviso primero y espera 30 segundos entre pruebas.'},429);
  const sent=await sendPush(body,await getVapid(env),notificationPayload(SITE,true),SITE);
  if(sent.status===404||sent.status===410){await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run();return response({error:'El permiso ha caducado. Desactiva el aviso y vuelve a activarlo.'},410);}
  if(!sent.ok)return response({error:'No se ha podido enviar la prueba. Vuelve a intentarlo.'},502);
  return response({ok:true});
}
export async function sendDaily(env,date=new Date(),fetcher=fetch,currentDate=new Date()){
  const {day,time}=madridMoment(date);if(time!=='23:23')return;
  // Skip delayed cron executions: don't deliver yesterday's minute as today's alert.
  const current=madridMoment(currentDate);if(current.day!==day||current.time!=='23:23')return;
  const {results}=await env.DB.prepare('SELECT endpoint,data FROM push_subscriptions WHERE last_day <> ? LIMIT 20').bind(day).all();
  if(!results.length)return;
  const vapid=await getVapid(env);
  for(const row of results){
    const claimed=await env.DB.prepare('UPDATE push_subscriptions SET last_day = ? WHERE endpoint = ? AND last_day <> ?').bind(day,row.endpoint,day).run();if(!claimed.meta.changes)continue;
    try{const sent=await sendPush(JSON.parse(row.data),vapid,notificationPayload(),SITE,fetcher);if(sent.status===404||sent.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();else if(!sent.ok)console.error('JP7 daily push rejected:',sent.status);}catch{console.error('JP7 daily push delivery failed');}
  }
}

// One-off preview requested for 8 October, 20:12 in Barcelona (18:12 UTC).
// Uses the test timestamp, leaving the daily 23:23 delivery record untouched.
export async function sendEveningPreview(env,date=new Date(),fetcher=fetch,currentDate=new Date()){
  const target=Date.parse('2026-10-08T18:12:00Z');
  if(date.getTime()<target||date.getTime()>=target+60000||currentDate.getTime()<target||currentDate.getTime()>=target+60000)return;
  const {results}=await env.DB.prepare('SELECT endpoint,data FROM push_subscriptions WHERE last_test < ? LIMIT 20').bind(target).all();
  if(!results.length)return;
  const vapid=await getVapid(env),payload={...notificationPayload(),url:SITE+'/#2323-test'};
  for(const row of results){
    const claimed=await env.DB.prepare('UPDATE push_subscriptions SET last_test = ? WHERE endpoint = ? AND last_test < ?').bind(currentDate.getTime(),row.endpoint,target).run();if(!claimed.meta.changes)continue;
    try{const sent=await sendPush(JSON.parse(row.data),vapid,payload,SITE,fetcher);if(sent.status===404||sent.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();else if(!sent.ok)console.error('JP7 preview push rejected:',sent.status);}catch{console.error('JP7 preview push delivery failed');}
  }
}
