// TRACEGUARD Service Worker
// Handles offline map tiles caching and push notifications

const CACHE_NAME = 'traceguard-cache-v1';
const MAP_CACHE_NAME = 'traceguard-maps-v1';
const TILE_URL_PATTERNS = [
  'tile.openstreetmap.org',
  'cartodb-basemaps',
  'tiles.stadiamaps.com'
];

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== MAP_CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests with caching strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Check if this is a map tile request
  const isMapTile = TILE_URL_PATTERNS.some(pattern => url.hostname.includes(pattern));
  
  if (isMapTile) {
    // Cache-first strategy for map tiles
    event.respondWith(
      caches.open(MAP_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached tile and update in background
            fetch(event.request).then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(event.request, networkResponse.clone());
              }
            }).catch(() => {});
            return cachedResponse;
          }
          
          // Fetch from network and cache
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Return a placeholder for offline tiles
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect fill="#1a1a2e" width="256" height="256"/><text x="128" y="128" text-anchor="middle" fill="#666" font-size="12">Offline</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        });
      })
    );
  } else if (event.request.mode === 'navigate') {
    // Network-first for navigation requests
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html');
      })
    );
  }
});

// Push notification event
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = {
    title: 'TRACEGUARD Alert',
    body: 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: 'traceguard-notification',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: data.requireInteraction,
      actions: data.actions,
      data: data.data || {}
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'dismiss') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        const targetUrl = event.notification.data?.url || '/';
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Background sync for offline SOS
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'offline-sos') {
    event.waitUntil(syncOfflineSOS());
  }
});

async function syncOfflineSOS() {
  try {
    // Get pending SOS from IndexedDB
    const db = await openDatabase();
    const pendingAlerts = await getAllPendingAlerts(db);
    
    for (const alert of pendingAlerts) {
      try {
        const response = await fetch('/api/incidents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${alert.token}`
          },
          body: JSON.stringify(alert.data)
        });
        
        if (response.ok) {
          await deletePendingAlert(db, alert.id);
          console.log('[SW] Synced offline SOS:', alert.id);
        }
      } catch (error) {
        console.error('[SW] Failed to sync SOS:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('traceguard-offline', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending-sos')) {
        db.createObjectStore('pending-sos', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

function getAllPendingAlerts(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-sos'], 'readonly');
    const store = transaction.objectStore('pending-sos');
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deletePendingAlert(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['pending-sos'], 'readwrite');
    const store = transaction.objectStore('pending-sos');
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'CACHE_MAP_AREA') {
    // Cache map tiles for a specific area
    const { bounds, zoom } = event.data;
    cacheMapArea(bounds, zoom).then(() => {
      event.ports[0].postMessage({ success: true });
    }).catch((error) => {
      event.ports[0].postMessage({ success: false, error: error.message });
    });
  }
  
  if (event.data.type === 'CLEAR_MAP_CACHE') {
    caches.delete(MAP_CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

async function cacheMapArea(bounds, zoom) {
  const cache = await caches.open(MAP_CACHE_NAME);
  const tileUrls = getTileUrlsForBounds(bounds, zoom);
  
  console.log(`[SW] Caching ${tileUrls.length} tiles for offline use`);
  
  const batchSize = 10;
  for (let i = 0; i < tileUrls.length; i += batchSize) {
    const batch = tileUrls.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (url) => {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (e) {
          console.warn('[SW] Failed to cache tile:', url);
        }
      })
    );
  }
}

function getTileUrlsForBounds(bounds, zoom) {
  const urls = [];
  const { north, south, east, west } = bounds;
  
  // Calculate tile coordinates
  const minX = lon2tile(west, zoom);
  const maxX = lon2tile(east, zoom);
  const minY = lat2tile(north, zoom);
  const maxY = lat2tile(south, zoom);
  
  // Generate tile URLs
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      urls.push(`https://a.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}.png`);
    }
  }
  
  return urls;
}

function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

console.log('[SW] Service worker loaded');
