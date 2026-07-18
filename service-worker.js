const CACHE_VERSION = 'v6.2.2';
const CACHE_NAME = 'rehab-app-' + CACHE_VERSION;
const VERSION = '6.2.1';
const urlsToCache = [
  './',
  './index.html',
  './data.js?v=' + VERSION,
  './scales.js?v=' + VERSION,
  './icons.js?v=' + VERSION,
  './app.js?v=' + VERSION,
  './manifest.json'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        return cache.addAll(urlsToCache).catch(function(err) {
          console.warn('部分资源缓存失败，仅缓存index.html:', err);
          return cache.add('./index.html');
        });
      })
      .catch(function(err) {
        console.error('Service Worker 安装失败:', err);
      })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(cacheName) {
          return cacheName !== CACHE_NAME;
        }).map(function(cacheName) {
          console.log('清理旧缓存:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      return self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'sw-updated', version: VERSION });
        });
      });
    })
  );
});

function getCacheUrl(request) {
  var url = new URL(request.url);
  var path = url.pathname.split('/').pop();
  var cachedMap = {
    'data.js': './data.js?v=' + VERSION,
    'scales.js': './scales.js?v=' + VERSION,
    'icons.js': './icons.js?v=' + VERSION,
    'app.js': './app.js?v=' + VERSION
  };
  if (cachedMap[path]) return cachedMap[path];
  return request;
}

function getFallbackHtml() {
  return new Response(
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>加载失败</title>' +
    '<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#faf8f5;}' +
    '.box{text-align:center;padding:40px 24px;max-width:320px;}.emoji{font-size:48px;margin-bottom:16px;}' +
    '.title{font-size:18px;font-weight:600;margin-bottom:8px;color:#1a1a1a;}' +
    '.desc{font-size:14px;color:#64748b;line-height:1.6;margin-bottom:20px;}' +
    '.btn{padding:12px 28px;background:#0d6e8c;color:#fff;border:none;border-radius:10px;font-size:15px;cursor:pointer;}</style></head>' +
    '<body><div class="box"><div class="emoji">⚠️</div><div class="title">页面加载失败</div>' +
    '<div class="desc">网络连接不稳定，页面暂时无法加载。<br>请检查网络后重试。</div>' +
    '<button class="btn" onclick="location.reload()">重新加载</button></div></body></html>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  if (url.pathname.endsWith('service-worker.js')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            var responseToCache = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            if (cached) return cached;
            return caches.match('./index.html').then(function(indexCached) {
              if (indexCached) return indexCached;
              return getFallbackHtml();
            });
          });
        })
    );
    return;
  }

  event.respondWith(
    caches.match(getCacheUrl(event.request))
      .then(function(cached) {
        var networkFetch = fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var responseToCache = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(getCacheUrl(event.request), responseToCache);
            });
          }
          return response;
        }).catch(function() {
          if (cached) return cached;
          if (url.pathname.endsWith('.js')) {
            return new Response('/* 资源加载失败，请刷新重试 */', {
              headers: { 'Content-Type': 'application/javascript' }
            });
          }
          return new Response('', { status: 404 });
        });
        return cached || networkFetch;
      })
      .catch(function() {
        return fetch(event.request).catch(function() {
          return getFallbackHtml();
        });
      })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'skipWaiting') {
    self.skipWaiting();
  }
});
