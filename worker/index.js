import {withConfirmedVisits,memoryPhotos} from '../shared/atlas-places.js';
import {pushApi,sendDaily,sendEveningPreview} from './notifications.js';
const encoder = new TextEncoder();
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const empty = () => ({places:[],habits:[],tasks:[],entries:[]});
async function sign(value, secret) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
function equal(a,b) {if(a.length!==b.length)return false;let v=0;for(let i=0;i<a.length;i++)v|=a.charCodeAt(i)^b.charCodeAt(i);return v===0;}
async function authenticated(request,secret) {
  const token=(request.headers.get('cookie')||'').match(/(?:^|;\s*)orbita_session=([^;]+)/)?.[1];
  if(!token)return false;const [expiry,signature]=token.split('.');
  return Number(expiry)>Date.now() && equal(signature||'',await sign(expiry,secret));
}
export function validState(s) {
  if(!s || !['places','habits','tasks','entries'].every(k=>Array.isArray(s[k])&&s[k].length<=5000))return false;
  const str=(x,n=1000)=>typeof x==='string'&&x.length<=n;
  const id=x=>str(x.id,100)&&/^[A-Za-z0-9_-]+$/.test(x.id);
  const date=x=>str(x,10)&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
  return s.places.every(x=>id(x)&&str(x.name,100)&&x.name.trim().length>0&&str(x.country,100)&&x.country.trim().length>0&&Number.isFinite(x.lat)&&Math.abs(x.lat)<=90&&Number.isFinite(x.lng)&&Math.abs(x.lng)<=180&&(x.date===''||date(x.date))&&str(x.note,2000)&&(x.dateLabel===undefined||str(x.dateLabel,100))&&(x.photo===undefined||Object.hasOwn(memoryPhotos,x.photo))&&(x.confirmation===undefined||['pending','yes','no'].includes(x.confirmation))&&(x.secret===undefined||typeof x.secret==='boolean'))
    &&s.habits.every(x=>id(x)&&str(x.name,100)&&x.name.trim().length>0&&['activity','dumbbell','briefcase-business','book-open','droplets','moon','footprints','target'].includes(x.icon)&&Array.isArray(x.days)&&x.days.length<=10000&&x.days.every(date))
    &&s.tasks.every(x=>id(x)&&str(x.title,250)&&x.title.trim().length>0&&typeof x.done==='boolean'&&['normal','high'].includes(x.priority)&&(x.due===''||date(x.due)))
    &&s.entries.every(x=>id(x)&&date(x.date)&&str(x.text,10000)&&x.text.trim().length>0&&['great','good','okay','low'].includes(x.mood));
}
export default {
  async scheduled(controller,env) {const date=new Date(controller.scheduledTime);await sendEveningPreview(env,date);await sendDaily(env,date);},
  async fetch(request,env) {
    const url=new URL(request.url);
    if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
    try {
      const secret=env.ORBITA_PASSWORD;
      const configured=typeof secret==='string'&&secret.length>=16;
      if(request.method!=='GET' && request.headers.get('origin')!==url.origin)return json({error:'Origen no permitido.'},403);
      if(url.pathname==='/api/session'&&request.method==='GET')return json({configured,authenticated:configured&&await authenticated(request,secret)});
      if(!configured)return json({error:'Falta configurar la clave privada en Cloudflare (mínimo 16 caracteres).'},503);
      if(url.pathname==='/api/login'&&request.method==='POST') {
        const ip=request.headers.get('CF-Connecting-IP')||'local';
        const key=await sign(ip,secret);const now=Date.now();
        await env.DB.prepare('DELETE FROM login_attempts WHERE expires < ?').bind(now).run();
        await env.DB.prepare('INSERT INTO login_attempts (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(key,now+900000).run();
        const attempts=await env.DB.prepare('SELECT count FROM login_attempts WHERE key = ?').bind(key).first();
        if(attempts.count>10)return json({error:'Demasiados intentos. Prueba dentro de 15 minutos.'},429);
        const body=await request.json();
        if(typeof body.password!=='string'||body.password.length>1024||!equal(await sign(body.password,secret),await sign(secret,secret)))return json({error:'La clave no es correcta.'},401);
        await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
        const expiry=String(now+30*86400000);const token=expiry+'.'+await sign(expiry,secret);
        return json({ok:true},200,{'Set-Cookie':`orbita_session=${token}; HttpOnly; ${url.protocol==='https:'?'Secure; ':''}SameSite=Strict; Path=/; Max-Age=2592000`});
      }
      if(!await authenticated(request,secret))return json({error:'Inicia sesión para abrir tu espacio.'},401);
      if(url.pathname.startsWith('/api/push/'))return await pushApi(request,env);
      if(url.pathname==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':'orbita_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Secure'});
      if(url.pathname==='/api/state'&&request.method==='GET') {
        await env.DB.prepare('INSERT OR IGNORE INTO app_state (id,data,revision) VALUES (1,?,0)').bind(JSON.stringify(empty())).run();
        for(let attempt=0;attempt<4;attempt++) {
          const row=await env.DB.prepare('SELECT data,revision FROM app_state WHERE id = 1').first();
          const state=JSON.parse(row.data),updated=withConfirmedVisits(state);
          if(updated===state)return json({state,revision:row.revision});
          const result=await env.DB.prepare('UPDATE app_state SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(JSON.stringify(updated),row.revision).run();
          if(result.meta.changes)return json({state:updated,revision:row.revision+1});
        }
        return json({error:'Se están guardando cambios. Vuelve a cargar tu espacio.'},409);
      }
      if(url.pathname==='/api/state'&&request.method==='PUT') {
        const raw=await request.text();if(raw.length>1000000)return json({error:'El contenido supera el límite de guardado.'},413);
        const body=JSON.parse(raw);if(!validState(body.state)||!Number.isInteger(body.revision))return json({error:'Datos no válidos.'},400);
        await env.DB.prepare('INSERT OR IGNORE INTO app_state (id,data,revision) VALUES (1,?,0)').bind(JSON.stringify(empty())).run();
        const result=await env.DB.prepare('UPDATE app_state SET data = ?, revision = revision + 1 WHERE id = 1 AND revision = ?').bind(JSON.stringify(body.state),body.revision).run();
        if(!result.meta.changes)return json({error:'Hay cambios guardados desde otro dispositivo. Recarga antes de continuar; copia primero el texto que tengas abierto.'},409);
        return json({revision:body.revision+1});
      }
      return json({error:'No encontrado.'},404);
    } catch(error) {console.error('Orbita API:',error.message);return json({error:'No se ha podido guardar o cargar. Comprueba la conexión e inténtalo de nuevo.'},503);}
  }
};
