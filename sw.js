
const CACHE='mctr-current45-true-offline-ocr-20260821-v1';
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
 '/ocr/worker.min.js':'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
 '/ocr/core/tesseract-core.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core.wasm.js',
 '/ocr/core/tesseract-core-simd.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core-simd.wasm.js',
 '/ocr/core/tesseract-core-lstm.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core-lstm.wasm.js',
 '/ocr/core/tesseract-core-simd-lstm.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@v5.0.0/tesseract-core-simd-lstm.wasm.js',
 '/ocr/lang/eng.traineddata.gz':'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'
};

const TESSERACT_MAIN='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

async function cacheRemoteAs(cache,key,url){
 try{
   const resp=await fetch(url,{cache:'no-store'});
   if(resp && (resp.ok || resp.type==='opaque')){
     await cache.put(key,resp.clone());
     return true;
   }
 }catch(e){}
 return false;
}

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   await cache.addAll(CORE).catch(()=>{});

   // Pre-download the OCR API itself plus worker/core/language resources while
   // internet exists. Failure here does not block app installation; warmOfflineOcr
   // retries from the page whenever service returns.
   await cacheRemoteAs(cache,TESSERACT_MAIN,TESSERACT_MAIN);
   for(const [path,url] of Object.entries(OCR_REMOTE)){
     const sameOriginKey=new URL(path,self.location.origin).toString();
     await cacheRemoteAs(cache,sameOriginKey,url);
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

 // Virtual same-origin OCR assets. Online: refresh/cache if missing.
 // Offline: return the already-downloaded copy.
 if(url.origin===self.location.origin && OCR_REMOTE[url.pathname]){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     const remote=OCR_REMOTE[url.pathname];
     try{
       const fresh=await fetch(remote,{cache:'no-store'});
       if(fresh && (fresh.ok || fresh.type==='opaque')){
         await cache.put(req,fresh.clone());
       }
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
   return;
 }

 // Cache the main CDN Tesseract API so the page can load it with no service.
 if(req.url===TESSERACT_MAIN){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const fresh=await fetch(req,{cache:'no-store'});
       await cache.put(req,fresh.clone()).catch(()=>{});
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
   return;
 }

 // Network-first navigation, offline fallback.
 if(req.mode==='navigate' || req.destination==='document' || url.pathname.endsWith('/index.html')){
   event.respondWith((async()=>{
     try{
       const fresh=await fetch(req,{cache:'no-store'});
       const cache=await caches.open(CACHE);
       cache.put('./index.html',fresh.clone()).catch(()=>{});
       return fresh;
     }catch(e){
       return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
     }
   })());
   return;
 }

 // Other static assets.
 event.respondWith((async()=>{
   const cached=await caches.match(req);
   if(cached)return cached;
   try{
     const fresh=await fetch(req);
     const cache=await caches.open(CACHE);
     cache.put(req,fresh.clone()).catch(()=>{});
     return fresh;
   }catch(e){
     return Response.error();
   }
 })());
});
