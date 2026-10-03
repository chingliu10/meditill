self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Online-first shell only. Offline sale synchronization is deliberately not implemented.
