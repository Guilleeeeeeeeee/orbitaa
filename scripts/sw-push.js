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
    for(const client of windows){if(new URL(client.url).origin===target.origin){await client.navigate(target.href);await client.focus();return;}}
    await self.clients.openWindow(target.href);
  })());
});
