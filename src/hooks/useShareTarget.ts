import { useEffect, useState, useCallback } from 'react';
import { useGiaStore } from '../store/useGiaStore';

export interface SharedContent {
  title?: string;
  text?: string;
  url?: string;
  files?: { name: string; type: string; data: string }[];
}

export function useShareTarget() {
  const [sharedContent, setSharedContent] = useState<SharedContent | null>(null);

  useEffect(() => {
    // Listen for service worker messages (POST share target)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'gia-share') {
        setSharedContent(event.data.payload);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);

    // Check for GET share target (URL params)
    const params = new URLSearchParams(window.location.search);
    const sharedParam = params.get('shared');
    if (sharedParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(sharedParam));
        setSharedContent(parsed);
        // Clean URL
        window.history.replaceState({}, '', '/');
      } catch {
        // Ignore parse errors
      }
    }

    // Check cache for any pending share from SW
    if ('caches' in window) {
      caches.open('gia-share-cache-v1').then(cache => {
        cache.match('/_gia_share').then(resp => {
          if (resp) {
            resp.json().then(data => {
              setSharedContent(data);
              cache.delete('/_gia_share');
            }).catch(() => {});
          }
        }).catch(() => {});
      }).catch(() => {});
    }

    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  const clearSharedContent = useCallback(() => {
    setSharedContent(null);
  }, []);

  const applySharedContent = useCallback(() => {
    if (!sharedContent) return;
    const store = useGiaStore.getState();
    const parts: string[] = [];

    if (sharedContent.title) parts.push(sharedContent.title);
    if (sharedContent.text) parts.push(sharedContent.text);
    if (sharedContent.url) parts.push(sharedContent.url);

    if (parts.length > 0) {
      store.setPendingInput(parts.join('\n\n'));
    }

    if (sharedContent.files && sharedContent.files.length > 0) {
      store.setPendingFiles(sharedContent.files.map(f => ({
        name: f.name,
        type: f.type,
        content: '',
        preview: f.data,
      })));
    }

    store.setModule('chat');
    setSharedContent(null);
  }, [sharedContent]);

  return { sharedContent, clearSharedContent, applySharedContent };
}
