const CACHE='mctr-current46-offline-ocr-20260821-v2';

const CORE=[
 './',
 './index.html',
 './manifest.json',
 './icon-192.png',
 './icon-512.png',
 './apple-touch-icon.png',
 './registry.json'
];

const OCR_REMOTE={
 '/ocr/worker.min.js':
   'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',

 '/ocr/core/tesseract-core.wasm.js':
   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',

 '/ocr/core/tesseract-core-simd.wasm.js':
   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js',

 '/ocr/core/tesseract-core-lstm.wasm.js':
   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js',

 '/ocr/core/tesseract-core-simd-lstm.wasm.js':
   'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',

 '/ocr/lang/eng.traineddata.gz':
   'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'
};

const TESSERACT_MAIN =
 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

async function fetchAndCache(cache, requestKey, remoteUrl){
 const request = typeof requestKey==='string' ? new Request(requestKey) : requestKey;

 // Already cached = immediately usable offline.
 const hit=await cache.match(request);
 if(hit)return hit;

 // Online first-time warmup.
 const resp=await fetch(remoteUrl,{cache:'no-store',mode:'cors'});
 if(!resp || !resp.ok)throw new Error(`HTTP ${resp&&resp.status} for ${remoteUrl}`);

 await cache.put(request,resp.clone());
 return resp;
}

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);

   // App shell failure must not prevent SW installation.
   for(const url of CORE){
     try{
       const r=await fetch(url,{cache:'reload'});
       if(r&&r.ok)await cache.put(url,r.clone());
     }catch(e){}
   }
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const names=await caches.keys();
   await Promise.all(names.filter(n=>n!==CACHE).map(n=>caches.delete(n)));
   await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;

 const url=new URL(req.url);

 // Virtual OCR files. These are requested from the SAME origin by Tesseract.
 // On first online use, fetch CDN -> cache. Offline, serve cache.
 if(url.origin===self.location.origin && OCR_REMOTE[url.pathname]){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       return await fetchAndCache(cache,req,OCR_REMOTE[url.pathname]);
     }catch(e){
       return Response.error();
     }
   })());
   return;
 }

 // Cache the main Tesseract browser API too.
 if(req.url===TESSERACT_MAIN){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const fresh=await fetch(req,{cache:'no-store',mode:'cors'});
       if(fresh&&fresh.ok)await cache.put(req,fresh.clone());
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
   return;
 }

 // Navigation is network-first so GitHub updates actually appear.
 if(req.mode==='navigate' || req.destination==='document'){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     try{
       const fresh=await fetch(req,{cache:'no-store'});
       if(fresh&&fresh.ok)await cache.put('./index.html',fresh.clone());
       return fresh;
     }catch(e){
       return (await cache.match('./index.html')) ||
              (await cache.match('./')) ||
              Response.error();
     }
   })());
   return;
 }

 // Other app assets are cache-first.
 event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const cached=await cache.match(req);
   if(cached)return cached;
   try{
     const fresh=await fetch(req);
     if(fresh&&fresh.ok)await cache.put(req,fresh.clone());
     return fresh;
   }catch(e){
     return Response.error();
   }
 })());
});
