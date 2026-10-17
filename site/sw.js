const CACHE_NAME = 'velopro-v1.0.1';
const ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/storage.js',
    '/js/api.js',
    '/js/push-client.js',
    '/js/app.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => {
                return Promise.all(
                    keys.filter((key) => key !== CACHE_NAME)
                        .map((key) => caches.delete(key))
                );
            })
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('push', (event) => {
    const options = {
        body: 'Новое уведомление от ВелоПРО',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Открыть'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };

    if (event.data) {
        const payload = event.data.json();
        options.body = payload.body || options.body;
        options.title = payload.title || 'ВелоПРО';
        options.data = payload.data || options.data;
    } else {
        options.title = 'ВелоПРО';
    }

    event.waitUntil(
        self.registration.showNotification(options.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});