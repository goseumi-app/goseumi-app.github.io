/* 고슴이 — 오프라인 지원
   방식: «네트워크 먼저, 안 되면 캐시».
   - 인터넷이 되면 항상 최신 화면을 받는다 (새 버전이 늦게 반영되는 일이 없다)
   - 신호가 없거나 느리면 3.5초 뒤 캐시로 넘어간다 (병원 지하·차 안에서도 열린다)
   기록은 원래 폰 안(localStorage)에만 있고, 이 캐시는 «화면 파일»만 담는다. */
const CACHE = "goseumi";
const SHELL = [
  "./", "./index.html", "./manifest.json",
  "./icon-192.png", "./icon-512.png",
  "./icon-maskable-192.png", "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];
const TIMEOUT = 3500;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), TIMEOUT);
    fetch(req).then(res => {
      clearTimeout(t);
      if (res && res.ok && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      resolve(res);
    }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   /* 쿠팡·구글 폰트는 손대지 않는다 */

  e.respondWith(
    fromNetwork(req).catch(() =>
      caches.match(req).then(hit =>
        hit || (req.mode === "navigate" ? caches.match("./index.html") : Promise.reject(new Error("offline")))
      )
    )
  );
});
