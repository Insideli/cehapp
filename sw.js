const CACHE='ceh-v25-universal-1';
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
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(req.mode==='navigate'||url.pathname.endsWith('/index.html')){
    event.respondWith((async()=>{try{const fresh=await fetch(req,{cache:'no-store'});if(fresh.ok){const c=await caches.open(CACHE);await c.put('./index.html',fresh.clone())}return fresh}catch(_){return (await caches.match('./index.html'))||Response.error()}})());return;
  }
  event.respondWith((async()=>{try{const fresh=await fetch(req,{cache:'no-cache'});if(fresh.ok){const c=await caches.open(CACHE);await c.put(req,fresh.clone())}return fresh}catch(_){return (await caches.match(req))||Response.error()}})());
});

// Flexible Push payload support: works with V23/V24 server payloads and future ones.
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};
    try{data=event.data?event.data.json():{}}catch(_){try{data={body:event.data?.text()||''}}catch(__){}}
    const title=data.title||data.notification?.title||'Цех';
    const body=data.body||data.notification?.body||'Есть новое событие в заказах';
    const orderId=data.order_id||data.orderId||data.data?.order_id||null;
    const launch=data.url||data.launch_url||data.data?.url||data.data?.launch_url||'./';
    const opts={body,icon:'./icon-192.png',badge:'./icon-192.png',tag:data.tag||(`ceh-${orderId||Date.now()}`),renotify:true,data:{url:launch,order_id:orderId}};
    await self.registration.showNotification(title,opts);
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const d=event.notification.data||{};let target;
    try{target=new URL(d.url||'./',self.location.origin)}catch(_){target=new URL('./',self.location.origin)}
    if(d.order_id)target.hash=`order=${encodeURIComponent(d.order_id)}`;
    const wins=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const c of wins){
      try{if(new URL(c.url).origin===target.origin){await c.focus();if('navigate' in c)await c.navigate(target.href);c.postMessage({type:'open-order',order_id:d.order_id||null});return}}catch(_){}
    }
    if(self.clients.openWindow)await self.clients.openWindow(target.href);
  })());
});
