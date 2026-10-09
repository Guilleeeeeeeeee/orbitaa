// JP7 ToDo · Guarda este script como «JP7 ToDo» en Scriptable.
const BASE='https://orbitaa.guillestyle2.workers.dev';
const KEY='jp7-todo-widget-key-v1';
const pink=new Color('#ff4faa'),muted=new Color('#a49ba9');
const params=args.queryParameters||{};
const runURL=(id)=>{const url=URLScheme.forRunningScript();return url+(url.includes('?')?'&':'?')+'complete='+encodeURIComponent(id);};
async function api(path,body){
  const request=new Request(BASE+'/api/widget/'+path);request.timeoutInterval=15;
  request.headers={Authorization:'Bearer '+Keychain.get(KEY),'Content-Type':'application/json'};
  if(body){request.method='POST';request.body=JSON.stringify(body);}
  const data=await request.loadJSON();
  if(request.response.statusCode>=400)throw Error(data.error||'No se ha podido conectar con JP7.');
  return data;
}
function text(stack,value,size,color=Color.white(),bold=false){const t=stack.addText(value);t.font=bold?Font.boldSystemFont(size):Font.systemFont(size);t.textColor=color;t.lineLimit=1;t.minimumScaleFactor=0.75;return t;}
function symbol(stack,name,size,color){const sf=SFSymbol.named(name);sf.applyFont(Font.systemFont(size));const image=stack.addImage(sf.image);image.imageSize=new Size(size,size);image.tintColor=color;return image;}
const widget=new ListWidget();widget.setPadding(16,16,14,16);
const gradient=new LinearGradient();gradient.colors=[new Color('#211b24'),new Color('#100f14')];gradient.locations=[0,1];widget.backgroundGradient=gradient;
widget.refreshAfterDate=new Date(Date.now()+5*60000);
try{
  if(!Keychain.contains(KEY)){
    if(config.runsInWidget)throw Error('Abre el script en Scriptable para conectar JP7.');
    const setup=new Alert();setup.title='Conectar JP7';setup.message='En JP7: Ajustes → Conectar Scriptable. Copia la clave privada y pégala aquí.';setup.addSecureTextField('Clave privada');setup.addAction('Conectar');setup.addCancelAction('Cancelar');
    if(await setup.presentAlert()<0)throw Error('Conexión cancelada.');
    const token=setup.textFieldValue(0).trim();if(!/^[a-f0-9]{64}$/.test(token))throw Error('La clave debe ser la que genera JP7 para el widget.');
    Keychain.set(KEY,token);
  }
  if(params.complete)await api('complete',{id:params.complete});
  const data=await api('today');
  const layout=widget.addStack();layout.layoutHorizontally();
  const left=layout.addStack();left.layoutVertically();left.size=new Size(79,0);
  symbol(left,'sun.max',24,pink);left.addSpacer(5);text(left,'Hoy',22,pink,true);text(left,'JP7 · ToDo',9,muted);left.addSpacer();
  const bottom=left.addStack();bottom.centerAlignContent();text(bottom,String(data.pending),37,Color.white(),true);bottom.addSpacer();
  const plus=bottom.addStack();plus.url=BASE+'/#tasks';symbol(plus,'plus.circle.fill',25,pink);
  layout.addSpacer(12);
  const list=layout.addStack();list.layoutVertically();list.backgroundColor=new Color('#ffffff',0.035);list.cornerRadius=16;list.setPadding(10,10,8,10);
  if(!data.tasks.length){symbol(list,'checkmark.circle',23,pink);list.addSpacer(7);text(list,'Todo listo por hoy',14,Color.white(),true);list.addSpacer(4);text(list,'Las tareas necesitan fecha de hoy.',9,muted);list.addSpacer();}
  else{
    for(const task of data.tasks.slice(0,3)){
      const row=list.addStack();row.centerAlignContent();row.url=runURL(task.id);
      symbol(row,'circle',21,pink);row.addSpacer(8);text(row,task.title,14,Color.white(),task.priority==='high');list.addSpacer(8);
    }
    list.addSpacer();text(list,data.pending>3?'+'+(data.pending-3)+' pendientes más':params.complete?'Guardado en JP7':'Toca para completar',9,muted);
  }
}catch(error){
  text(widget,'JP7 · ToDo',18,pink,true);widget.addSpacer(10);
  const message=widget.addText(error.message||'No se ha podido cargar.');message.font=Font.systemFont(12);message.textColor=Color.white();
  widget.addSpacer();text(widget,'Ejecuta el script para configurar.',10,muted);
  widget.url=URLScheme.forRunningScript();
  // A revoked/expired key can be entered again on the next run.
  if(/Vuelve a conectar/.test(error.message)&&Keychain.contains(KEY))Keychain.remove(KEY);
}
Script.setWidget(widget);
if(!config.runsInWidget)await widget.presentMedium();
Script.complete();
