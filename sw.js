const CACHE='mctr-offline-map-v119';
const TILE_CACHE='mctr-viewed-map-tiles-v99';
const TILE_LIMIT=450;
const MAP_LIBS=new Set(['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css']);

const CORE=[
 './',
 './index.html',
 './manifest.json',
 './manifest.webmanifest',
 './404.html',
 './icon-192.png',
 './icon-512.png',
 './apple-touch-icon.png',
 './registry.json',
 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// Version-pinned OCR runtime. These are deliberately cached under their real
// request URLs so Tesseract can keep using its normal URLs while the service
// worker supplies the bytes from CacheStorage when the phone is offline.
const OCR=[
 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js',
 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'
];
const OCR_SET=new Set(OCR);

async function cacheResponse(cache,key,response){
 // CORS responses are normal 2xx. Opaque responses have status 0 but are still
 // valid cached subresources, so keep either form.
 if(response && (response.ok || response.type==='opaque')){
   await cache.put(key,response.clone());
 }
 return response;
}

async function warmOcr(cache){
 for(const url of OCR){
   try{
     if(await cache.match(url))continue;
     let resp;
     try{ resp=await fetch(url,{cache:'no-store',mode:'cors'}); }
     catch(e){ resp=await fetch(url,{cache:'no-store',mode:'no-cors'}); }
     await cacheResponse(cache,url,resp);
   }catch(e){}
 }
}

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   // Cache the app shell individually so one optional asset cannot abort install.
   for(const path of CORE){
     try{
       const resp=await fetch(path,{cache:'reload'});
       await cacheResponse(cache,path,resp);
     }catch(e){}
   }
   // Online installation also warms the complete OCR runtime.
   await warmOcr(cache);
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const names=await caches.keys();
   await Promise.all(names.filter(name=>name!==CACHE && name!==TILE_CACHE).map(name=>caches.delete(name)));
   await self.clients.claim();
 })());
});

self.addEventListener('message',event=>{
 if(event.data&&event.data.type==='WARM_OCR'){
   event.waitUntil((async()=>{
     const cache=await caches.open(CACHE);
     await warmOcr(cache);
   })());
 }
});

self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);

 // Save map tiles as the user views them online. No bulk tile downloads.
 // The separate bounded cache limits storage consumption on iOS.
 const isStreetTile=/^(?:[abc]\.)?tile\.openstreetmap\.org$/.test(url.hostname) && /^\/\d+\/\d+\/\d+\.png$/.test(url.pathname);
 const isSatelliteTile=url.hostname==='server.arcgisonline.com' && url.pathname.includes('/World_Imagery/MapServer/tile/');
 if(isStreetTile||isSatelliteTile){
   event.respondWith((async()=>{
     const cache=await caches.open(TILE_CACHE);
     const old=await cache.match(req);
     if(old)return old;
     try{
       const response=await fetch(req);
       if(response.ok||response.type==='opaque'){
         await cache.put(req,response.clone());
         const keys=await cache.keys();
         if(keys.length>TILE_LIMIT){
           for(const key of keys.slice(0,keys.length-TILE_LIMIT))await cache.delete(key);
         }
       }
       return response;
     }catch(e){
       return (await cache.match(req)) || new Response('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#dce3e9"/><text x="128" y="128" text-anchor="middle" font-size="14" fill="#64748b">Not cached offline</text></svg>',{headers:{'Content-Type':'image/svg+xml'}});
     }
   })());
   return;
 }
 if(MAP_LIBS.has(req.url) || (url.hostname==='unpkg.com' && url.pathname.startsWith('/leaflet@1.9.4/dist/images/'))){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const hit=await cache.match(req);
     if(hit)return hit;
     try{const response=await fetch(req);await cacheResponse(cache,req,response);return response;}
     catch(e){return (await cache.match(req))||Response.error();}
   })());
   return;
 }

 // OCR is cache-first. If the phone is online and an item is missing, fetch it
 // once and store it. Offline requests then use exactly the same cached URL.
 if(OCR_SET.has(req.url)){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req.url);
     if(cached)return cached;
     try{
       const fresh=await fetch(req,{cache:'no-store'});
       await cacheResponse(cache,req.url,fresh);
       return fresh;
     }catch(e){
       return (await cache.match(req.url)) || Response.error();
     }
   })());
   return;
 }

 // Navigation stays network-first so deployments update normally, with a full
 // offline fallback to the last known-good application shell.
 if(req.mode==='navigate' || req.destination==='document' || url.pathname.endsWith('/index.html')){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     try{
       const fresh=await fetch(req,{cache:'no-store'});
       if(fresh && fresh.ok){
         await cache.put('./index.html',fresh.clone());
         return fresh;
       }
     }catch(e){}
     return (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            Response.error();
   })());
   return;
 }

 // Same-origin application assets are cache-first for dependable offline use.
 if(url.origin===self.location.origin){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const fresh=await fetch(req);
       await cacheResponse(cache,req,fresh);
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
 }
});
