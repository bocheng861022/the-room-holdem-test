const CACHE='the-room-v33';
const ASSETS=['./','./index.html','./styles.css?v=18','./app.js?v=31','./src/game-engine.mjs?v=20','./manifest.webmanifest','./assets/app-icon-1024.png','./assets/club-interior.png','./privacy.html','./terms.html','./support.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;if(event.request.mode==='navigate')event.respondWith(fetch(event.request).then(response=>{let copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));else event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request))) });
