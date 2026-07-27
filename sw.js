// Balitopia service worker.
// App shell (HTML/CSS/JS/sprites, ~1.3 MB) is cache-first so a second visit is
// instant and the game works offline. Audio is stale-while-revalidate and kept
// in a separate, size-capped cache so a 100 MB library can't evict the shell.
const VERSION = 'v1';
const SHELL = 'balitopia-shell-' + VERSION;
const MEDIA = 'balitopia-media-' + VERSION;
const MEDIA_MAX = 60;   // entries, trimmed LRU-ish on write

const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/data.js',
  './js/sprites.js',
  './js/audio.js',
  './js/game.js',
  './assets/img/title_vs.jpg',
  './assets/img/story_bg.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      // addAll fails the whole install if any single file 404s — add
      // individually so one missing asset can't break offline support entirely
      .then(c => Promise.all(SHELL_FILES.map(f => c.add(f).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== MEDIA).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cacheName, max) {
  const c = await caches.open(cacheName);
  const keys = await c.keys();
  if (keys.length <= max) return;
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isMedia = /\.(mp3|wav|ogg|opus|m4a|mp4|webm)$/i.test(url.pathname);

  if (isMedia) {
    // stale-while-revalidate: play instantly from cache, refresh in background
    e.respondWith((async () => {
      const c = await caches.open(MEDIA);
      const hit = await c.match(req);
      const net = fetch(req).then(res => {
        if (res && res.ok) { c.put(req, res.clone()); trim(MEDIA, MEDIA_MAX); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })());
    return;
  }

  // shell: cache-first, fall back to network, then to the cached index
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && /\.(js|css|html|png|webp|jpg|svg|json)$/i.test(url.pathname)) {
        const c = await caches.open(SHELL);
        c.put(req, res.clone());
      }
      return res;
    } catch (err) {
      if (req.mode === 'navigate') {
        const idx = await caches.match('./index.html');
        if (idx) return idx;
      }
      throw err;
    }
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
