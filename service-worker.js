const CACHE="kevin-job-agent-v9";
const ASSETS=["./","./index.html","./styles.css","./custom-jobs.css","./applied-search.css","./app.js","./sync.js","./custom-jobs.js","./applied-search.js","./sync-hardening.js","./manifest.webmanifest","./jobs.json","./icons/icon-192.png","./icons/icon-512.png","./icons/maskable-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);
  if(url.pathname.endsWith("/jobs.json")){
    e.respondWith(fetch(e.request,{cache:"no-store"}).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put("./jobs.json",copy));return res}).catch(()=>caches.match("./jobs.json")));
    return;
  }
  if(url.origin!==self.location.origin){e.respondWith(fetch(e.request));return;}
  e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match(e.request)));
});