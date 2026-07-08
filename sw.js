/* ========================================
   پرسا - Service Worker
   استراتژی: Cache First با fallback آفلاین
   ======================================== */

const CACHE_NAME = "porsa-v2";
const OFFLINE_PAGE = "offline.html";

const urlsToCache = [
    "index.html",
    "style.css",
    "app.js",
    "logo.png",
    "manifest.json",
    "Kalameh-Thin.ttf",
    "Kalameh-ExtraLight.ttf",
    "Kalameh-Light.ttf",
    "Kalameh-Regular.ttf",
    "Kalameh-Medium.ttf",
    "Kalameh-SemiBold.ttf",
    "Kalameh-Bold.ttf",
    "Kalameh-ExtraBold.ttf",
    "Kalameh-Black.ttf"
];

// نصب - کش همه فایل‌ها
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Porsa SW] Caching all files');
            return cache.addAll(urlsToCache);
        })
    );
    self.skipWaiting();
});

// فعال‌سازی - پاک کردن کش‌های قدیمی
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => {
                        console.log('[Porsa SW] Deleting old cache:', key);
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// استراتژی: Cache First, then Network
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                // آپدیت کش در پس‌زمینه
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseClone);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // fallback برای صفحات HTML
                if (event.request.mode === 'navigate') {
                    return caches.match('index.html');
                }
                return new Response('Offline', { status: 503 });
            });
        })
    );
});
