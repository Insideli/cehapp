const CACHE='ceh-v24-weekend-polish-1';
const CORE=['./manifest.webmanifest','./icon-192.png','./icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of CORE){try{const r=await fetch(url,{cache:'reload'});if(r.ok)await cache.put(url,r.clone())}catch(_){}}
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;

  // HTML/навигация: сеть всегда первая. Старый index не должен "залипать".
  if(req.mode==='navigate' || url.pathname.endsWith('/index.html')){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});
        if(fresh.ok){const c=await caches.open(CACHE);await c.put('./index.html',fresh.clone())}
        return fresh;
      }catch(_){return (await caches.match('./index.html')) || Response.error()}
    })());
    return;
  }

  // Остальные локальные файлы: сеть первая, кэш только как офлайн-резерв.
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req,{cache:'no-cache'});
      if(fresh.ok){const c=await caches.open(CACHE);await c.put(req,fresh.clone())}
      return fresh;
    }catch(_){return (await caches.match(req)) || Response.error()}
  })());
});


// V24 Web Push.
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let payload={};
    try{payload=event.data?event.data.json():{}}catch(_){payload={body:event.data?event.data.text():''}}
    const title=payload.title||'ЦЕХ';
    const options={
      body:payload.body||'Есть новое рабочее событие',
      icon:payload.icon||'./icon-192.png',
      badge:payload.badge||'./icon-192.png',
      tag:payload.tag||'ceh-event',
      renotify:true,
      silent:false,
      vibrate:[180,80,180],
      data:{url:payload.url||'./',order_id:payload.order_id||null}
    };
    await self.registration.showNotification(title,options);
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const data=event.notification.data||{};
    const url=new URL(data.url||'./',self.location.origin).href;
    const list=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of list){
      try{
        const a=new URL(c.url),b=new URL(url);
        if(a.origin===b.origin && a.pathname===b.pathname && a.search===b.search){
          await c.focus();
          if(data.order_id)c.postMessage({type:'open-order',order_id:data.order_id});
          return;
        }
      }catch(_){}
    }
    const w=await clients.openWindow(url);
    if(w&&data.order_id){setTimeout(()=>{try{w.postMessage({type:'open-order',order_id:data.order_id})}catch(_){}},700)}
  })());
});
