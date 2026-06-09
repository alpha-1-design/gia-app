const SHARE_CACHE = 'gia-share-cache-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith(handleShare(event.request));
    return;
  }

  if (url.pathname === '/share' && event.request.method === 'GET') {
    const title = url.searchParams.get('title') || '';
    const text = url.searchParams.get('text') || '';
    const sharedUrl = url.searchParams.get('url') || '';
    event.respondWith(Response.redirect(`/?shared=${encodeURIComponent(JSON.stringify({ title, text, url: sharedUrl }))}`, 302));
    return;
  }
});

async function handleShare(request) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') || '';
    const text = formData.get('text') || '';
    const sharedUrl = formData.get('url') || '';

    const shared = { title: String(title), text: String(text), url: String(sharedUrl), files: [] };

    const files = formData.getAll('files');
    for (const file of files) {
      if (file instanceof File && file.size > 0) {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        const dataUrl = `data:${file.type};base64,${base64}`;
        shared.files.push({ name: file.name, type: file.type, data: dataUrl });
      }
    }

    const cache = await caches.open(SHARE_CACHE);
    const response = new Response(JSON.stringify(shared), {
      headers: { 'Content-Type': 'application/json', 'X-GIA-Share': 'true' },
    });
    await cache.put('/_gia_share', response.clone());

    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      client.postMessage({ type: 'gia-share', payload: shared });
    }

    return Response.redirect('/', 302);
  } catch (e) {
    console.error('[GIA SW] Share handler failed:', e);
    return Response.redirect('/', 302);
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
