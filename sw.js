const PAGE = 'ori-page-1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(PAGE).then(c => c.put('index.html', copy));
    return r;
  }).catch(() => caches.open(PAGE).then(c => c.match('index.html'))));
});
