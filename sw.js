const V='payesh-v4-1-2n';
const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','lib/exceljs.min.js','lib/html2pdf.bundle.min.js','fonts/fonts.css','fonts/Vazirmatn.woff2','fonts/NotoNaskh-400.woff2','fonts/NotoNaskh-700.woff2','fonts/Lalezar.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 e.respondWith(fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request).then(m=>m||caches.match('index.html'))))});
