const CACHE_NAME = 'payesh-electronic-v2-fast';
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './payesh-storage.js',
    './proposal-generator.js',
    './pdf-lib.min.js',
    './proposal-template.pdf'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                PRECACHE_ASSETS.map((url) => cache.add(url).catch(() => null))
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Stale-While-Revalidate for HTML/JS & Cache-First for heavy PDF/Font assets
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isHeavyStatic = url.pathname.endsWith('.pdf') ||
                          url.pathname.endsWith('.min.js') ||
                          url.pathname.endsWith('.woff2') ||
                          url.pathname.endsWith('.ttf');

    if (isHeavyStatic) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((networkRes) => {
                    if (networkRes && networkRes.status === 200) {
                        const clone = networkRes.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return networkRes;
                });
            })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request).then((networkRes) => {
                if (networkRes && networkRes.status === 200) {
                    const clone = networkRes.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return networkRes;
            }).catch(() => cached);

            return cached || fetchPromise;
        })
    );
});