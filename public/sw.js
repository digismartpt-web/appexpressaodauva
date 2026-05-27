const CACHE_NAME = 'pizzeria-image-cache-v1';

// Caching strategy: Stale-While-Revalidate for images
self.addEventListener('fetch', (event) => {
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchedResponse = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || fetchedResponse;
                });
            })
        );
    }
});

self.addEventListener('install', (event) => {
    self.skipWaiting();
});
