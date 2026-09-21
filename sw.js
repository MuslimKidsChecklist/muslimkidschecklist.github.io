/* Muslim Kids Checklist service worker.
   TASK-023/024, 21 Sep 2026, following the same rule Spelling Quest's TASK-350
   worker follows (Universal Files/Service-Workers-Offline-and-Install.md):

   THE RULE: the HTML is NEVER served cache-first.

   Muslim Kids Checklist is a SINGLE hand-written index.html with no build step
   and no stamped (?v=) assets, exactly like Spelling Quest. Cache it cache-first
   and a family is frozen on that build forever, with no way out short of
   clearing site data. Because nothing is stamped, there is deliberately NO
   cache-first branch for scripts -- only images, which are stable, cheap to
   re-fetch, and safe to reuse if evicted.

   Bump CACHE to throw everything away. */
const CACHE = 'mkc-v1';

/* Kept deliberately small -- never precache heavy media on a first visit to a
   site nobody has paid for yet. */
const SHELL = ['./', './index.html', './page.css', './manifest.webmanifest'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c =>
    // Individually, not addAll: one 404 in addAll aborts the whole install and
    // leaves the site with no worker at all.
    Promise.all(SHELL.map(u => c.add(u).catch(() => {})))
  ));
});

self.addEventListener('activate', e => e.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.map(n => n !== CACHE ? caches.delete(n) : null));
  await self.clients.claim();          // take over tabs that are already open
})()));

const isPage = req =>
  req.mode === 'navigate' ||
  (req.headers.get('accept') || '').includes('text/html');

const isCacheable = url =>
  /\.(png|jpg|jpeg|gif|webp|svg|woff2?|ttf|otf)$/i.test(url.pathname);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  /* Never touch Supabase (sync) or Gumroad (license checks) or anything else
     cross-origin. A family's checklist and license state must never be
     answered out of a cache -- this is what makes the sync/license calls
     network-only without touching their own code at all. */
  if (url.origin !== self.location.origin) return;

  if (isPage(req)) {
    /* NETWORK FIRST. A push is picked up on the next ordinary load, exactly as
       it would be with no worker at all. The cache is only a fallback for when
       the network genuinely is not there. */
    e.respondWith((async () => {
      try {
        /* {cache:'no-store'} matters far more than it looks: a plain fetch() of
           a navigation request inside a worker can still be answered from the
           browser's OWN HTTP cache, so a new build is not picked up on an
           ordinary reload -- the exact failure this file exists to prevent.
           Network-first is only network-first if you say so explicitly. */
        const fresh = await fetch(req.url, { cache: 'no-store', credentials: 'same-origin' });
        if (fresh && fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req))
            || (await caches.match('./index.html'))
            || Response.error();
      }
    })());
    return;
  }

  if (isCacheable(url)) {
    /* Cache first, filled as pages are opened rather than precached. */
    e.respondWith((async () => {
      const hit = await caches.match(req);
      if (hit) return hit;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone());
        return fresh;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  // Anything else (same-origin, non-page, non-cacheable) goes straight to the
  // network -- including page.css, which is small and should always be fresh.
});
