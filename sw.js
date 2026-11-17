'use strict';
importScripts('rpg/offline-manifest.js');
const PAGE = 'ori-page-3-' + self.ORI_OFFLINE.version;
const BASE = new URL('./', self.location);
const URLS = new Set(self.ORI_OFFLINE.files.map(p => new URL(p, BASE).href));
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(PAGE);
  await cache.addAll(self.ORI_OFFLINE.files);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  const normalized = new URL(url);
  normalized.search = '';
  normalized.hash = '';
  if (normalized.pathname === BASE.pathname) normalized.pathname += 'index.html';
  const isShell = URLS.has(normalized.href);
  const isVoice = /^voice(?:-v[23])?\/.*\.mp3$/.test(url.pathname.slice(BASE.pathname.length));
  if (!isShell && !isVoice) return;
  event.respondWith((async () => {
    if (isShell) {
      const cache = await caches.open(PAGE);
      return await cache.match(normalized.href) || fetch(event.request);
    }
    const cached = await caches.match(normalized.href);
    if (cached) return cached;
    return fetch(event.request);
  })());
});
