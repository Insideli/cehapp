
const CACHE='cehapp-v264-stable-1';
const LEGACY_OWN_CACHES=new Set(['ceh-v263-real-ui-1']);
const CORE=['./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const SCOPE_URL=new URL(self.registration.scope);

function isOwnUrl(value){
  try{
    const url=value instanceof URL?value:new URL(value,SCOPE_URL);
    return url.origin===SCOPE_URL.origin && url.pathname.startsWith(SCOPE_URL.pathname);
  }catch(_){return false}
}

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    for(const url of CORE){
      try{
        const r=await fetch(url,{cache:'reload'});
        if(r.ok)await cache.put(url,r.clone());
      }catch(_){}
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(
      keys
        .filter(k=>k!==CACHE&&(k.startsWith('cehapp-')||LEGACY_OWN_CACHES.has(k)))
        .map(k=>caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;

  const url=new URL(req.url);
  if(!isOwnUrl(url))return;

  // HTML: сначала интернет.
  // Поэтому новые версии GitHub Pages появляются без старого кэша.
  if(req.mode==='navigate'||url.pathname.endsWith('/index.html')){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req,{cache:'no-store'});

        if(fresh.ok){
          const c=await caches.open(CACHE);
          await c.put('./index.html',fresh.clone());
        }

        return fresh;
      }catch(_){
        return (await caches.match('./index.html'))||Response.error();
      }
    })());

    return;
  }

  // Остальные файлы приложения:
  // сначала интернет, кэш только как запасной вариант.
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req,{cache:'no-cache'});

      if(fresh.ok){
        const c=await caches.open(CACHE);
        await c.put(req,fresh.clone());
      }

      return fresh;
    }catch(_){
      return (await caches.match(req))||Response.error();
    }
  })());
});

// ===============================
// PUSH-УВЕДОМЛЕНИЯ
// ===============================
self.addEventListener('push',event=>{
  event.waitUntil((async()=>{
    let data={};

    try{
      data=event.data?event.data.json():{};
    }catch(_){
      try{
        data={body:event.data?.text()||''};
      }catch(__){}
    }

    const title=
      data.title||
      data.notification?.title||
      'Цех';

    const body=
      data.body||
      data.notification?.body||
      'Есть новое событие в заказах';

    const orderId=
      data.order_id||
      data.orderId||
      data.data?.order_id||
      null;

    let launch=
      data.url||
      data.launch_url||
      data.data?.url||
      data.data?.launch_url||
      './';

    try{
      const u=new URL(launch,SCOPE_URL);

      if(!isOwnUrl(u)){
        launch='./';
      }
    }catch(_){
      launch='./';
    }

    await self.registration.showNotification(title,{
      body,
      icon:'./icon-192.png',
      badge:'./icon-192.png',
      tag:data.tag||`ceh-${orderId||Date.now()}`,
      renotify:true,
      data:{
        url:launch,
        order_id:orderId
      }
    });
  })());
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();

  event.waitUntil((async()=>{
    const d=event.notification.data||{};

    let target;

    try{
      target=new URL(d.url||'./',SCOPE_URL);
    }catch(_){
      target=new URL('./',SCOPE_URL);
    }

    if(!isOwnUrl(target)){
      target=new URL('./',SCOPE_URL);
    }

    if(d.order_id){
      target.hash=`order=${encodeURIComponent(d.order_id)}`;
    }

    const windows=await self.clients.matchAll({
      type:'window',
      includeUncontrolled:true
    });

    for(const client of windows){
      try{
        const clientUrl=new URL(client.url);

        if(isOwnUrl(clientUrl)){
          await client.focus();

          if('navigate' in client){
            await client.navigate(target.href);
          }

          client.postMessage({
            type:'open-order',
            order_id:d.order_id||null
          });

          return;
        }
      }catch(_){}
    }

    if(self.clients.openWindow){
      await self.clients.openWindow(target.href);
    }
  })());
});
