const CACHE_PREFIX = 'rdr-pwa-shell-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/rdr-192.png',
  '/icons/rdr-512.png',
  '/icons/rdr-180.png',
];

// The app passes its public Firebase web configuration in the worker URL when
// the user enables push. These Firebase web values are public client settings.
const workerUrl = new URL(self.location.href);
const encodedFirebaseConfig = workerUrl.searchParams.get('firebaseConfig');

if (encodedFirebaseConfig) {
  try {
    importScripts(
      'https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js',
    );

    const firebaseConfig = JSON.parse(encodedFirebaseConfig);
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

    firebase.messaging().onBackgroundMessage((payload) => {
      const data = payload.data || {};
      const title = data.title || 'Roadshow Device Request';
      const body = data.body || 'There is an update waiting for you in RDR.';

      return self.registration.showNotification(title, {
        body,
        icon: '/icons/rdr-192.png',
        badge: '/icons/rdr-180.png',
        data: { url: data.url || '/' },
        tag: data.requestId || 'rdr-update'
      });
    });
  } catch (error) {
    console.error('RDR Firebase messaging setup failed in the service worker:', error);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Leave writes, API calls, Firebase calls, and cross-origin requests untouched.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || Response.error()),
    );
    return;
  }

  // Cache only built static assets. Do not cache authenticated or business data.
  if (/\.(?:js|css|woff2?|png|svg|ico)$/i.test(url.pathname) && !url.pathname.startsWith('/__/')) {
    event.respondWith(
      caches.match(request).then(async (cached) => {
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      }),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = event.notification.data?.url || '/';
  const targetUrl = new URL(requestedUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existingClient = windowClients.find(client => client.url.startsWith(self.location.origin));
        if (existingClient) {
          return existingClient.focus().then(() => existingClient.navigate(targetUrl));
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
