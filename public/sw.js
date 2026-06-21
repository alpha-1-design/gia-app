const SHARE_CACHE = 'gia-share-cache-v1';
const TG_CACHE = 'gia-telegram-cache-v1';
const TG_MSG_KEY = '_gia_telegram_messages';
const TG_OFFSET_KEY = '_gia_telegram_offset';
const TG_PENDING_KEY = '_gia_tg_pending';

let tgConfig = null;
let tgLastUpdateId = 0;
let tgPollTimer = null;
let tgProcessedUpdates = new Set();
let tgNoClientsCount = 0;

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

  // Allow the app to check if there are pending messages via fetch
  if (url.pathname === '/_gia/tg-pending') {
    event.respondWith(handleTgPendingCheck());
    return;
  }

  if (url.pathname === '/_gia/tg-messages') {
    event.respondWith(handleTgGetMessages());
    return;
  }
});

async function handleTgPendingCheck() {
  try {
    const cache = await caches.open(TG_CACHE);
    const cached = await cache.match(TG_PENDING_KEY);
    if (cached) {
      return new Response('1', { headers: { 'Content-Type': 'text/plain' } });
    }
  } catch {}
  return new Response('0', { headers: { 'Content-Type': 'text/plain' } });
}

async function handleTgGetMessages() {
  try {
    const cache = await caches.open(TG_CACHE);
    const cached = await cache.match(TG_MSG_KEY);
    if (cached) {
      const data = await cached.json();
      // Clear stored messages after retrieval
      await cache.delete(TG_MSG_KEY);
      await cache.delete(TG_PENDING_KEY);
      return Response.json(Array.isArray(data) ? data : []);
    }
  } catch {}
  return Response.json([]);
}

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

// ---- Telegram Background Polling ----

async function tgStoreOffset() {
  try {
    const cache = await caches.open(TG_CACHE);
    const resp = new Response(String(tgLastUpdateId), {
      headers: { 'Content-Type': 'text/plain' },
    });
    await cache.put(TG_OFFSET_KEY, resp.clone());
  } catch {}
}

async function tgLoadOffset() {
  try {
    const cache = await caches.open(TG_CACHE);
    const cached = await cache.match(TG_OFFSET_KEY);
    if (cached) {
      const text = await cached.text();
      const val = parseInt(text, 10);
      if (!isNaN(val)) return val;
    }
  } catch {}
  return 0;
}

async function tgShouldPoll() {
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  return allClients.length === 0;
}

async function tgPoll() {
  if (!tgConfig || !tgConfig.token) {
    // No config — stop polling
    tgStopPolling();
    return;
  }

  // Only poll when no clients are open (tab is closed/backgrounded)
  const shouldPoll = await tgShouldPoll();
  if (!shouldPoll) {
    tgNoClientsCount = 0;
    return;
  }

  tgNoClientsCount++;
  // Wait 3 cycles (~9s) after last client closes before starting to poll
  if (tgNoClientsCount < 3) return;

  try {
    const params = new URLSearchParams({
      timeout: '25',
      offset: String(tgLastUpdateId),
      allowed_updates: JSON.stringify(['message']),
    });

    const res = await fetch(`https://api.telegram.org/bot${tgConfig.token}/getUpdates?${params}`, {
      signal: AbortSignal.timeout(30000),
    });
    const data = await res.json();
    if (!data.ok) return;

    const newMessages = [];

    for (const update of (data.result || [])) {
      tgLastUpdateId = Math.max(tgLastUpdateId, update.update_id + 1);

      const msg = update.message;
      if (!msg?.text) continue;

      if (tgProcessedUpdates.has(update.update_id)) continue;
      tgProcessedUpdates.add(update.update_id);
      if (tgProcessedUpdates.size > 10000) {
        tgProcessedUpdates.clear();
      }

      if (msg.from?.is_bot) continue;

      const chat = msg.chat;
      const isGroup = chat.type === 'group' || chat.type === 'supergroup';
      const chatTitle = chat.title || (isGroup ? 'Group' : undefined);

      if (isGroup && tgConfig.mentionOnly && tgConfig.botUsername) {
        const mention = `@${tgConfig.botUsername.toLowerCase()}`;
        if (!msg.text.toLowerCase().includes(mention)) continue;
      }

      newMessages.push({
        id: String(update.update_id),
        channel: 'telegram',
        from: msg.from?.first_name || msg.from?.username || 'User',
        text: msg.text,
        timestamp: msg.date * 1000,
        chatId: String(chat.id),
        chatTitle,
        isGroup,
      });
    }

    // Store offset periodically
    if (newMessages.length > 0) {
      await tgStoreOffset();

      // Cache messages for retrieval when app reopens
      const cache = await caches.open(TG_CACHE);
      const existing = await tgGetCachedMessages();
      const all = [...existing, ...newMessages];
      const trimmed = all.slice(-200);
      const response = new Response(JSON.stringify(trimmed), {
        headers: { 'Content-Type': 'application/json' },
      });
      await cache.put(TG_MSG_KEY, response.clone());

      // Set pending flag
      const pendingResp = new Response('1', {
        headers: { 'Content-Type': 'text/plain' },
      });
      await cache.put(TG_PENDING_KEY, pendingResp.clone());
    }
  } catch (e) {
    // Silently fail — will retry on next interval
  }
}

async function tgGetCachedMessages() {
  try {
    const cache = await caches.open(TG_CACHE);
    const cached = await cache.match(TG_MSG_KEY);
    if (cached) {
      const data = await cached.json();
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

function tgStartPolling() {
  if (tgPollTimer) return;
  tgNoClientsCount = 0;
  tgPollTimer = setInterval(tgPoll, 3000);
}

function tgStopPolling() {
  if (tgPollTimer) {
    clearInterval(tgPollTimer);
    tgPollTimer = null;
  }
  tgNoClientsCount = 0;
}

function tgResetState() {
  tgStopPolling();
  tgConfig = null;
  tgLastUpdateId = 0;
  tgProcessedUpdates.clear();
}

self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'gia-tg-configure':
      (async () => {
        const savedOffset = await tgLoadOffset();
        tgConfig = {
          token: msg.token,
          botUsername: msg.botUsername || null,
          mentionOnly: msg.mentionOnly || false,
        };
        tgLastUpdateId = Math.max(savedOffset, msg.offset || 0);
        tgProcessedUpdates.clear();
        tgStartPolling();
        event.source?.postMessage({ type: 'gia-tg-status', polling: true, lastUpdateId: tgLastUpdateId });
      })();
      break;

    case 'gia-tg-update-offset':
      if (msg.offset > tgLastUpdateId) {
        tgLastUpdateId = msg.offset;
        tgStoreOffset();
      }
      break;

    case 'gia-tg-stop':
      tgResetState();
      // Also clear cached messages
      (async () => {
        const cache = await caches.open(TG_CACHE);
        await cache.delete(TG_MSG_KEY);
        await cache.delete(TG_PENDING_KEY);
        await cache.delete(TG_OFFSET_KEY);
      })();
      break;

    case 'gia-tg-get-missed':
      (async () => {
        const messages = await tgGetCachedMessages();
        // Clear after reading
        const cache = await caches.open(TG_CACHE);
        await cache.delete(TG_MSG_KEY);
        await cache.delete(TG_PENDING_KEY);
        event.source?.postMessage({ type: 'gia-tg-missed-messages', messages });
      })();
      break;
  }
});
