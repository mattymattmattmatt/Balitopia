// A versioned, atomic game shell. Navigations check the network; versioned
// scripts/CSS remain cache-first. Existing saves live in localStorage.
const VERSION = 'v4-red-splatter';
const SHELL = 'balitopia-shell-' + VERSION;
const MEDIA = 'balitopia-media-' + VERSION;
const MEDIA_MAX = 60;
const SHELL_FILES = [
  './', './index.html', './manifest.json',
  './assets/img/title_vs.jpg', './assets/img/story_bg.jpg',
  './css/style.css?v=4-red-splatter', './css/studio.css?v=4-red-splatter',
  './js/data.js?v=4-red-splatter', './js/sprites.js?v=4-red-splatter',
  './js/audio.js?v=4-red-splatter', './js/expedition.js?v=4-red-splatter',
  './js/gore.js?v=4-red-splatter', './js/update.js?v=4-red-splatter', './js/game.js?v=4-red-splatter',
];
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    // A missing core file rejects installation and leaves the previous worker
    // active. Bypass the HTTP cache so this release cannot precache old code.
    await c.addAll(SHELL_FILES.map(f => new Request(new URL(f, self.location.href), { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('balitopia-') && k !== SHELL && k !== MEDIA).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
async function trim(c) {
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MEDIA_MAX; i++) await c.delete(keys[i]);
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/\.(mp3|wav|ogg|opus|m4a|mp4|webm)$/i.test(url.pathname)) {
    const network = caches.open(MEDIA).then(async c => {
      const res = await fetch(req);
      if (res.ok) { await c.put(req, res.clone()); await trim(c); }
      return res;
    });
    e.waitUntil(network.catch(() => {}));
    e.respondWith(caches.open(MEDIA).then(async c => (await c.match(req)) || network));
    return;
  }
  e.respondWith((async () => {
    const c = await caches.open(SHELL);
    if (req.mode === 'navigate') {
      try {
        const res = await fetch(new Request(req, { cache: 'no-store' }));
        if (res.ok) {
          const html = await res.clone().text();
          const marker = `<meta name="balitopia-build" content="${VERSION.slice(1)}">`;
          if (html.includes(marker)) { await c.put('./index.html', res.clone()); return res; }
          // A newer entry page must wait for its matching scripts to finish
          // installing. Otherwise a patchy connection can mix two releases.
          e.waitUntil(self.registration.update().catch(() => {}));
        }
      } catch (_) { /* Use the current build's entry point offline. */ }
      const fallback = await c.match('./index.html');
      return fallback || Response.error();
    }
    const hit = await c.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && /\.(js|css|html|png|webp|jpg|svg|json)$/i.test(url.pathname)) await c.put(req, res.clone());
    return res;
  })());
});
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
