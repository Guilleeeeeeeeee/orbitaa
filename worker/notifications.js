import {generateVapid,validSubscription,sendPush,PushSendError} from './web-push.js';
const SITE='https://orbitaa.guillestyle2.workers.dev';
export async function ensurePushTables(env){
  // Some existing Workers are deployed directly without running new D1 migrations.
  // Only initialise push tables; never touch the user's habits, tasks or memories.
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS push_config (id INTEGER PRIMARY KEY CHECK(id = 1), data TEXT NOT NULL)').run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS push_subscriptions (endpoint TEXT PRIMARY KEY, data TEXT NOT NULL, last_day TEXT NOT NULL DEFAULT '', last_test INTEGER NOT NULL DEFAULT 0)").run();
}
export function madridMoment(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));
  return {day:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export function notificationPayload(origin=SITE,test=false){
  return {title:test?'JP7 · Prueba de las 23:23':'SON LAS 23:23!!!',body:test?'Así llegará el aviso de las 23:23. Toca para ver el cartel.':'Toca para ver el cartel.',icon:origin+'/jp7-chrome-192.png',tag:test?'jp7-2323-test':'jp7-2323',url:origin+'/#2323'+(test?'-test':''),test};
}
export async function getVapid(env){
  await ensurePushTables(env);
  let row=await env.DB.prepare('SELECT data FROM push_config WHERE id = 1').first();
  if(!row){const pair=await generateVapid();await env.DB.prepare('INSERT OR IGNORE INTO push_config (id,data) VALUES (1,?)').bind(JSON.stringify(pair)).run();row=await env.DB.prepare('SELECT data FROM push_config WHERE id = 1').first();}
  return JSON.parse(row.data);
}
const response=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function pushApi(request,env,fetcher=fetch,currentDate=new Date()){
  try{await ensurePushTables(env);return await handlePushApi(request,env,fetcher,currentDate);}
  catch(error){
    console.error('JP7 push failed:',error.name);
    const database=/D1|SQLITE|no such table|database/i.test(error.message||'');
    return response({error:database?'No se ha podido preparar el guardado de notificaciones (PUSH_DATABASE).':'No se ha podido completar el envío de la notificación (PUSH_INTERNAL).',code:database?'PUSH_DATABASE':'PUSH_INTERNAL'},503);
  }
}
async function handlePushApi(request,env,fetcher,currentDate){
  const path=new URL(request.url).pathname;
  if(path==='/api/push/config'&&request.method==='GET')return response({publicKey:(await getVapid(env)).publicKey,time:'23:23',timezone:'Europe/Madrid'});
  if(!['/api/push/subscribe','/api/push/test','/api/push/real-preview'].includes(path))return response({error:'No encontrado.'},404);
  if(!['POST','DELETE'].includes(request.method))return response({error:'Método no permitido.'},405);
  if(['/api/push/test','/api/push/real-preview'].includes(path)&&request.method!=='POST')return response({error:'Método no permitido.'},405);
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
  if(path==='/api/push/real-preview'){
    // The requested final look at the real alert, once per registered device today.
    if(madridMoment(currentDate).day!=='2026-10-10')return response({ok:true,skipped:true});
    const registered=await env.DB.prepare('SELECT data FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).first();
    if(!registered)return response({error:'Activa las notificaciones primero.'},404);
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS push_oneoffs (endpoint TEXT NOT NULL, delivery TEXT NOT NULL, PRIMARY KEY(endpoint,delivery))').run();
    const delivery='final-2323-2026-10-10';
    const claimed=await env.DB.prepare('INSERT OR IGNORE INTO push_oneoffs (endpoint,delivery) VALUES (?,?)').bind(body.endpoint,delivery).run();
    if(!claimed.meta.changes)return response({ok:true,skipped:true});
    try{
      const payload={...notificationPayload(),url:SITE+'/#2323-now'};
      const sent=await sendPush(JSON.parse(registered.data),await getVapid(env),payload,SITE,fetcher);
      if(!sent.ok)throw Error('Push rejected');
      return response({ok:true,sent:true});
    }catch{
      await env.DB.prepare('DELETE FROM push_oneoffs WHERE endpoint = ? AND delivery = ?').bind(body.endpoint,delivery).run();
      return response({error:'No se ha podido enviar el aviso.'},502);
    }
  }
  const now=Date.now();
  const claim=await env.DB.prepare('UPDATE push_subscriptions SET last_test = ? WHERE endpoint = ? AND last_test < ?').bind(now,body.endpoint,now-30000).run();
  if(!claim.meta.changes)return response({error:'Activa el aviso primero y espera 30 segundos entre pruebas.'},429);
  // Database/key loading must not be misreported as a network failure.
  const vapid=await getVapid(env);
  let sent;
  try{sent=await sendPush(body,vapid,notificationPayload(SITE,true),SITE,fetcher);}catch(error){
    if(!(error instanceof PushSendError))throw error;
    const code='PUSH_'+error.stage;
    // Only expose standard error classes, never messages containing keys or endpoints.
    const allowed=['TypeError','OperationError','DataError','InvalidAccessError','NotSupportedError','SyntaxError','NetworkError','AbortError','TimeoutError'];
    const errorType=allowed.includes(error.cause?.name)?error.cause.name:'Error';
    const explanation={AUTH:'El servidor no ha podido firmar la notificación.',ENCRYPTION:'El servidor no ha podido cifrar la notificación para este dispositivo.',TRANSPORT:'El servidor no ha podido conectar con el servicio de notificaciones.'}[error.stage];
    console.error('JP7 push send failed:',code,errorType);
    return response({error:`${explanation} (${code} / ${errorType}).`,code,errorType},502);
  }
  if(sent.status===404||sent.status===410){await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(body.endpoint).run();return response({error:'El permiso ha caducado. Desactiva el aviso y vuelve a activarlo.'},410);}
  if(!sent.ok){
    let reason='';try{const data=await sent.json();if(typeof data.reason==='string'&&/^[A-Za-z0-9_-]{1,60}$/.test(data.reason))reason=data.reason;}catch{}
    const code=`PUSH_PROVIDER_${sent.status}${reason?'_'+reason:''}`;
    console.error('JP7 push provider rejected:',code);
    return response({error:`El servicio de notificaciones ha rechazado la prueba (${code}).`,code},502);
  }
  return response({ok:true});
}
export async function sendDaily(env,date=new Date(),fetcher=fetch,currentDate=new Date()){
  const {day,time}=madridMoment(date);if(time!=='23:23')return;
  // Skip delayed cron executions: don't deliver yesterday's minute as today's alert.
  const current=madridMoment(currentDate);if(current.day!==day||current.time!=='23:23')return;
  await ensurePushTables(env);
  const {results}=await env.DB.prepare('SELECT endpoint,data FROM push_subscriptions WHERE last_day <> ? LIMIT 20').bind(day).all();
  if(!results.length)return;
  const vapid=await getVapid(env);
  for(const row of results){
    const claimed=await env.DB.prepare('UPDATE push_subscriptions SET last_day = ? WHERE endpoint = ? AND last_day <> ?').bind(day,row.endpoint,day).run();if(!claimed.meta.changes)continue;
    try{const sent=await sendPush(JSON.parse(row.data),vapid,notificationPayload(),SITE,fetcher);if(sent.status===404||sent.status===410)await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(row.endpoint).run();else if(!sent.ok)console.error('JP7 daily push rejected:',sent.status);}catch{console.error('JP7 daily push delivery failed');}
  }
}
