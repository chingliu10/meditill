const CACHE='meditill-shell-v6';
const SHELL=[
  '/offline.html',
  '/css/app.css',
  '/js/app.js',
  '/images/default-medicine.svg',
  '/images/meditill-icon.svg',
  '/manifest.webmanifest'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;

  const url=new URL(request.url);

  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('/offline.html')));
    return;
  }

  if(url.origin!==self.location.origin)return;

  const isMutableAsset=url.pathname.startsWith('/js/')||url.pathname.startsWith('/css/');
  const isStaticAsset=url.pathname.startsWith('/images/')||url.pathname==='/manifest.webmanifest';

  if(isMutableAsset){
    event.respondWith(
      fetch(request)
        .then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(request))
    );
    return;
  }

  if(isStaticAsset){
    event.respondWith(
      caches.match(request).then(cached=>{
        if(cached)return cached;
        return fetch(request).then(response=>{
          if(response&&response.ok){
            const copy=response.clone();
            caches.open(CACHE).then(cache=>cache.put(request,copy));
          }
          return response;
        });
      })
    );
  }
});
