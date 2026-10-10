const api=async(path,options={})=>{const res=await fetch('/api/push/'+path,{...options,headers:{'Content-Type':'application/json'}});const data=await res.json();if(!res.ok)throw Error(data.error||'No se ha podido configurar el aviso.');return data;};
const ios=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
let subscription=null,working=false,lastSyncError=null;
export function notificationSettings(demo=false){return `<div class="settings-section moment-settings"><button class="button primary" data-action="push-enable" aria-pressed="false" disabled>Permitir notificaciones</button><p class="push-status" id="push-status" role="status" hidden>${demo?'Activa el aviso desde tu espacio privado.':'Comprobando este dispositivo…'}</p></div>`;}
function controls(message,enabled=false,available=false,showError=false){const status=document.querySelector('#push-status');if(!status)return;status.textContent=message;status.hidden=!showError&&(available||!message);const toggle=document.querySelector('[data-action="push-enable"]');toggle.textContent=enabled?'✓ Permitir notificaciones':'Permitir notificaciones';toggle.setAttribute('aria-pressed',String(enabled));toggle.disabled=!available||working;}
export async function synchronizeNotifications(){
  if(ios()&&!installed()||window.Notification?.permission!=='granted'||!navigator.serviceWorker)return;
  try{
    const registration=await navigator.serviceWorker.getRegistration();
    const current=await registration?.pushManager?.getSubscription();
    if(!current)return;
    await api('subscribe',{method:'POST',body:JSON.stringify(current.toJSON())});
    await api('real-preview',{method:'POST',body:JSON.stringify(current.toJSON())});
    lastSyncError=null;
  }catch(error){lastSyncError=error.message;controls(lastSyncError,!!subscription,true,true);}
}
export async function updateNotificationSettings(demo=false){
  if(demo)return;
  if(ios()&&!installed()){controls('En iPhone: añade JP7 a la pantalla de inicio y ábrela desde su icono para activar el aviso.');return;}
  if(!('Notification'in window)||!('serviceWorker'in navigator)){controls('Este navegador no permite notificaciones. Prueba desde la app instalada o Chrome / Edge.');return;}
  if(Notification.permission==='denied'){controls('Permiso bloqueado. En el iPhone: Ajustes → Notificaciones → JP7 → Permitir notificaciones. Después vuelve a abrir JP7.');return;}
  subscription=null;
  controls(Notification.permission==='default'?'Todavía no has dado permiso. Pulsa Permitir notificaciones y acepta el aviso de iOS.':'Pulsa Activar aviso para registrar este dispositivo.',false,true);
  try{const registration=await navigator.serviceWorker.getRegistration();if(!registration){controls('Pulsa Permitir notificaciones para dar permiso y terminar de preparar JP7.',false,true);return;}if(!registration.pushManager){controls('Este navegador no permite avisos push. En iPhone, abre JP7 desde su icono en la pantalla de inicio.');return;}subscription=await registration.pushManager.getSubscription();if(subscription){await synchronizeNotifications();if(lastSyncError){controls(lastSyncError,true,true,true);return;}}controls(subscription?'Aviso activado en este dispositivo · todos los días a las 23:23.':Notification.permission==='default'?'Todavía no has dado permiso. Pulsa Permitir notificaciones y acepta el aviso de iOS.':'El aviso está desactivado en este dispositivo.',!!subscription,true);}catch{controls('No se ha podido comprobar el registro. Pulsa el botón para volver a prepararlo.',false,true);}
}
export async function notificationAction(action){
  if(working)return;working=true;controls('Preparando el aviso…',!!subscription,true);
  try{
    if(subscription){
      await api('subscribe',{method:'DELETE',body:JSON.stringify({endpoint:subscription.endpoint})});await subscription.unsubscribe();subscription=null;controls('Aviso desactivado en este dispositivo.',false,true);return;
    }
    // Request permission directly in the click handler, before waiting on network calls.
    const permission=await Notification.requestPermission();if(permission!=='granted'){controls('No has permitido las notificaciones. Puedes cambiarlo desde los ajustes de JP7.',false,permission!=='denied');return;}
    if(!await navigator.serviceWorker.getRegistration())await navigator.serviceWorker.register('/sw.js');
    let readyTimer;
    const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(Error('JP7 está terminando de actualizarse. Cierra y vuelve a abrir la app e inténtalo otra vez.')),10000);})]).finally(()=>clearTimeout(readyTimer));
    if(!registration.pushManager)throw Error('Los avisos no están disponibles aquí. En iPhone, abre JP7 desde su icono, no desde una pestaña de Safari.');
    const {publicKey}=await api('config');
    const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
    try{await api('subscribe',{method:'POST',body:JSON.stringify(subscription.toJSON())});}catch(error){await subscription.unsubscribe();subscription=null;throw error;}
    controls('Aviso activado · cada noche a las 23:23.',true,true);
    await synchronizeNotifications();
  }catch(error){controls(error.message,!!subscription,true,true);}
  finally{working=false;const toggle=document.querySelector('[data-action="push-enable"]');if(toggle)toggle.disabled=window.Notification?.permission==='denied';}
}
const glyphs={S:['01111','10000','10000','01110','00001','00001','11110'],O:['01110','10001','10001','10001','10001','10001','01110'],N:['10001','11001','11001','10101','10011','10011','10001'],L:['10000','10000','10000','10000','10000','10000','11111'],A:['01110','10001','10001','11111','10001','10001','10001'],'2':['01110','10001','00001','00010','00100','01000','11111'],'3':['11110','00001','00001','01110','00001','00001','11110'],':':['00000','00100','00100','00000','00100','00100','00000'],'!':['00100','00100','00100','00100','00100','00000','00100'],' ':Array(7).fill('00000')};
const ledText=()=>[...'SON LAS 23:23!!!'].map(letter=>`<span class="led-letter">${glyphs[letter].join('').split('').map(bit=>`<i class="${bit==='1'?'lit':''}"></i>`).join('')}</span>`).join('');
let momentTimer;
export function showMoment(preview=false,replay=false){
  document.querySelector('#jp7-moment')?.remove();clearInterval(momentTimer);
  const now=new Date(),parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(now).split(':');
  const isMinute=parts[0]==='23'&&parts[1]==='23';
  const seconds=preview||replay?60:isMinute?60-Number(parts[2]):0;
  const overlay=document.createElement('dialog');overlay.id='jp7-moment';overlay.className='moment-dialog';overlay.innerHTML=`<button class="icon-button moment-close" aria-label="Cerrar el momento de las 23:23">×</button><span class="moment-eyebrow">${preview?'VISTA PREVIA · JP7':'23:23 · JP7'}</span><div class="moment-clock">23<span>:</span>23</div><div class="led-panel" role="img" aria-label="SON LAS 23:23!!!"><div class="led-marquee">${Array.from({length:2},()=>`<div class="led-message" aria-hidden="true">${ledText()}</div>`).join('')}</div></div>${seconds?'':'<p>El aviso de hoy ha terminado.</p>'}<small class="moment-countdown">${seconds?'': 'Próximo aviso: mañana a las 23:23.'}</small>`;
  document.body.append(overlay);overlay.showModal();const close=()=>{clearInterval(momentTimer);overlay.close();overlay.remove();};overlay.querySelector('button').onclick=close;overlay.addEventListener('close',()=>clearInterval(momentTimer));overlay.addEventListener('click',event=>{if(event.target===overlay)close();});
  if(seconds){const end=Date.now()+seconds*1000;const tick=()=>{const remaining=Math.max(0,Math.ceil((end-Date.now())/1000));overlay.querySelector('.moment-countdown').textContent=`${remaining} segundos ${preview?'· vista previa':replay?'':'hasta las 23:24'}`;if(!remaining)close();};tick();momentTimer=setInterval(tick,1000);}
}
export function openMomentLink(){if(['#2323','#2323-test','#2323-now'].includes(location.hash)){showMoment(location.hash.endsWith('-test'),location.hash==='#2323-now');history.replaceState(null,'','#world');}}
