const PAGE = 'ori-page-2';
const ASSETS = ['index.html','v2.html','img/ori.png','img/alien1.png','img/alien2.png','img/alien3.png'];
const ASSET_URLS = new Set(ASSETS.map(path => new URL(path,self.location).pathname));
self.addEventListener('install', e => e.waitUntil(caches.open(PAGE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || (e.request.mode !== 'navigate' && !ASSET_URLS.has(url.pathname))) return;
  e.respondWith((async () => {
    const cache = await caches.open(PAGE);
    try {
      const response = await fetch(e.request);
      if (response.ok) await cache.put(e.request,response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(e.request,{ignoreSearch:true});
      if (cached) return cached;
      if (url.pathname.endsWith('/')) return await cache.match(new URL('index.html',url).href,{ignoreSearch:true}) || Response.error();
      return Response.error();
    }
  })());
});
