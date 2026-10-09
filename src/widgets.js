export function widgetSettings(demo){return `<div class="settings-section"><h3>Widget ToDo · Hoy</h3><p>Tus tareas con fecha de hoy, en un widget oscuro y rosa. Al tocar una tarea, Scriptable se abre para marcarla como hecha.</p>${demo?'<p>Entra en tu espacio privado para conectar el widget.</p>':`<div class="moment-actions"><button class="button primary" data-action="widget-connect">Conectar Scriptable</button><button class="button subtle" data-action="widget-revoke">Desconectar widget</button></div><div id="widget-setup"></div>`}</div>`;}
export async function widgetAction(action){
  const el=document.querySelector('#widget-setup');if(!el)return;
  if(action==='widget-copy'){
    const res=await fetch('/jp7-todo.js');if(!res.ok){el.querySelector('#widget-code-status').textContent='No se ha podido cargar el código.';return;}
    const code=await res.text();
    try{await navigator.clipboard.writeText(code);el.querySelector('#widget-code-status').textContent='Código copiado. Pégalo en Scriptable.';}
    catch{const area=document.createElement('textarea');area.readOnly=true;area.value=code;area.rows=6;area.style.width='100%';area.setAttribute('aria-label','Código para Scriptable');el.append(area);area.select();el.querySelector('#widget-code-status').textContent='Selecciona y copia este código.';}
    return;
  }
  const buttons=document.querySelectorAll('[data-action="widget-connect"],[data-action="widget-revoke"]');buttons.forEach(b=>b.disabled=true);el.textContent='Preparando…';
  try{
    const res=await fetch('/api/widget/token',{method:action==='widget-revoke'?'DELETE':'POST',headers:{'Content-Type':'application/json'}}),data=await res.json();if(!res.ok)throw Error(data.error||'No se ha podido conectar.');
    if(action==='widget-revoke'){el.textContent='Widget desconectado. La clave anterior ya no funciona.';return;}
    el.innerHTML=`<p>Tu clave privada está aquí. Cópiala después de pegar el código en Scriptable. Una clave nueva sustituye a la anterior.</p><input id="widget-token" readonly aria-label="Clave privada del widget" autocomplete="off" spellcheck="false"><p>1. Pulsa <button class="text-button" data-action="widget-copy">Copiar código</button> o abre <a href="/jp7-todo.js" target="_blank" rel="noopener">el código del widget</a>, copia todo y pégalo en un script nuevo de Scriptable llamado <strong>JP7 ToDo</strong>.</p><p><span id="widget-code-status" role="status"></span></p><p>2. Ejecútalo con ▶. Cuando pida la clave, vuelve aquí, cópiala y pégala en Scriptable. 3. Añade un widget mediano de Scriptable y selecciona ese script.</p><p>Solo aparecen tareas con fecha de hoy. El widget puede tardar en actualizarse tras marcar una tarea.</p>`;
    const input=el.querySelector('input');input.value=data.token;input.onclick=()=>input.select();
  }catch(error){el.textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
}
