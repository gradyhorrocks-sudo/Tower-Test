const CACHE='mctr-current48-offline-root-fix-v1';

const CORE=[
 './',
 './index.html',
 './manifest.json',
 './icon-192.png',
 './icon-512.png',
 './apple-touch-icon.png',
 './registry.json'
];

const TESSERACT_MAIN='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';

const OCR_REMOTE={
 '/ocr/worker.min.js':'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
 '/ocr/core/tesseract-core.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
 '/ocr/core/tesseract-core-simd.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js',
 '/ocr/core/tesseract-core-lstm.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js',
 '/ocr/core/tesseract-core-simd-lstm.wasm.js':'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
 '/ocr/lang/eng.traineddata.gz':'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz'
};

async function putIfOk(cache,key,response){
 if(response && response.ok){
   await cache.put(key,response.clone());
 }
 return response;
}

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil((async()=>{
   const cache=await caches.open(CACHE);
   for(const path of CORE){
     try{
       const resp=await fetch(path,{cache:'reload'});
       await putIfOk(cache,path,resp);
     }catch(e){}
   }
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
   const names=await caches.keys();
   await Promise.all(names.filter(name=>name!==CACHE).map(name=>caches.delete(name)));
   await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);

 if(url.origin===self.location.origin && OCR_REMOTE[url.pathname]){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const fresh=await fetch(OCR_REMOTE[url.pathname],{cache:'no-store',mode:'cors'});
       await putIfOk(cache,req,fresh);
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
   return;
 }

 if(req.url===TESSERACT_MAIN){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const fresh=await fetch(req,{cache:'no-store',mode:'cors'});
       await putIfOk(cache,req,fresh);
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
   return;
 }

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

 if(url.origin===self.location.origin){
   event.respondWith((async()=>{
     const cache=await caches.open(CACHE);
     const cached=await cache.match(req);
     if(cached)return cached;
     try{
       const fresh=await fetch(req);
       await putIfOk(cache,req,fresh);
       return fresh;
     }catch(e){
       return (await cache.match(req)) || Response.error();
     }
   })());
 }
});
