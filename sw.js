const CACHE='mctr-grouped-site-pins-v83';

const CORE=[
 './',
 './index.html',
 './manifest.json',
 './manifest.webmanifest',
 './404.html',
 './icon-192.png',
 './icon-512.png',
 './apple-touch-icon.png',
 './registry.json'
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
   await Promise.all(names.filter(name=>name!==CACHE).map(name=>caches.delete(name)));
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
