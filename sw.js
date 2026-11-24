// Nur die öffentliche, datenfreie SpareParts-App offline zwischenspeichern.
const CACHE='spareparts-private-shell-v04-privacy-print-share';
const CORE=['./','./index.html','./style.css','./app.js','./manifest.webmanifest','./icon.png','./taski-logo.png',...Array.from({length:7},(_,i)=>`./category-images/category-${String(i+1).padStart(2,'0')}.webp`)];
self.addEventListener('install',event=>event.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{const all=await caches.keys();await Promise.all(all.filter(n=>n.startsWith('spareparts-')&&n!==CACHE).map(n=>caches.delete(n)));await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const u=new URL(event.request.url);if(event.request.method!=='GET'||u.origin!==location.origin)return;event.respondWith((async()=>{const c=await caches.open(CACHE);const cached=await c.match(event.request);if(cached)return cached;return fetch(event.request);})());});
