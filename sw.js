/* سرویس‌ورکر ابزار پایش: برای آپدیت، عدد نسخه را بالا ببر */
const V = 'payesh-v11-29-0';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const CDN = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET') return;
  if (u.hostname === 'api.github.com') return;          // همگام‌سازی گیت‌هاب هرگز کش نشود
  const sameOrigin = u.origin === location.origin;
  if (!sameOrigin && !CDN.includes(u.hostname)) return;
  if (sameOrigin) {                                      // اول شبکه، اگر نبود کش (آپدیت‌ها زود برسند)
    e.respondWith(fetch(r).then(res => {
      if (res && res.ok) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    }).catch(() => caches.match(r).then(h => h || caches.match('./index.html'))));
  } else {                                               // کتابخانه‌ها و فونت‌ها: اول کش
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); }
      return res;
    })));
  }
});

self.addEventListener('notificationclick',function(e){e.notification.close();e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(function(l){if(l.length)return l[0].focus();return self.clients.openWindow('./')}))});
