self.addEventListener('push',event=>{
  let payload;try{payload=event.data?.json();}catch{}
  payload=payload||{title:'JP7',body:'Tienes un nuevo aviso en tu espacio.'};
  event.waitUntil(self.registration.showNotification(payload.title||'JP7',{
    body:payload.body||'',icon:'/jp7-chrome-192.png',tag:payload.tag||'jp7-2323',
    data:{url:payload.url||'/#2323'},
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    let target=new URL(event.notification.data?.url||'/#2323',self.location.origin);
    if(target.origin!==self.location.origin)target=new URL('/#2323',self.location.origin);
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const candidates=windows.filter(client=>new URL(client.url).origin===target.origin);
    candidates.sort((a,b)=>Number(b.focused)-Number(a.focused));
    for(const client of candidates){
      try{
        await client.focus();
        // Open the overlay in the existing app without replacing its current screen/form.
        const handled=await new Promise(resolve=>{
          const channel=new MessageChannel();
          const timer=setTimeout(()=>{channel.port1.close();resolve(false);},1000);
          channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.opened===true);};
          client.postMessage({type:'JP7_OPEN_MOMENT',url:target.href},[channel.port2]);
        });
        if(!handled){const navigated=await client.navigate(target.href);await (navigated||client).focus();}
        return;
      }catch{ /* Try another app window, then open the notification URL. */ }
    }
    await self.clients.openWindow(target.href);
  })());
});
