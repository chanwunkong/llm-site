// 離線使用：先抓網路上的新版，抓不到才用上次存下的檔案，所以有網路時一定是最新版。
// 只存這個網站和 CDN 的程式；發音評分服務的請求不經過這裡，錄音也不會被存下來。
const CACHE = 'word-territory';
const CDN = ['cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || (url.origin !== location.origin && !CDN.includes(url.hostname))) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      // 發布時檔名會加上新的版本號（?v=…），離線時改找同一個檔案的任何版本
      const hit = await cache.match(req) || await cache.match(req, { ignoreSearch: true })
        || (req.mode === 'navigate' && await cache.match('./', { ignoreSearch: true }));
      if (hit) return hit;
      throw err;
    }
  })());
});
