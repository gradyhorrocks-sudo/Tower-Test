
const CACHE='mctr-current44-offline-scan-fix-20260820-v1';
const CORE=[
 './',
 './index.html',
 './manifest.json',
 './icon-192.png',
 './icon-512.png',
 './apple-touch-icon.png',
 './registry.json'];

self.addEventListener('install',event=>{
 self.skipWaiting();
 event.waitUntil(
   caches.open(CACHE).then(cache=>cache.addAll(CORE).catch(()=>{}))
 );
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

 // Always prefer network for document/navigation requests so new GitHub deploys win.
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

 // Static assets: cache-first, then network and refresh cache.
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
