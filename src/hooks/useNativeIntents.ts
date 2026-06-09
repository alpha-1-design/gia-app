import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { GIAIntent } from '../services/GIAIntent';
import { useGiaStore } from '../store/useGiaStore';
import { logger } from '../utils/logger';

export function useNativeIntents() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return;

    const init = async () => {
      try {
        // Check for a pending intent that launched the app
        const pending = await GIAIntent.getPendingIntent();
        if (pending.action) {
          handleIntentAction(pending.action, pending);
        }

        // Listen for ASSIST (long-press home button)
        await GIAIntent.addListener('onAssist', (data) => {
          logger.log('[NativeIntents] Assist triggered:', data.source);
          useGiaStore.getState().setModule('chat');
          useGiaStore.getState().addNotification('🎤 GIA assistant activated');
          // Trigger voice input
          useGiaStore.getState().setPendingAction({
            type: 'assist',
            data: { source: data.source },
          });
        });

        // Listen for deep links (gia://, giap://)
        await GIAIntent.addListener('onDeepLink', (data) => {
          logger.log('[NativeIntents] Deep link received:', data.uri);
          useGiaStore.getState().setPendingAction({
            type: 'deep-link',
            data: { url: data.uri, scheme: data.scheme, path: data.path, query: data.query },
          });
          useGiaStore.getState().setModule('chat');
          useGiaStore.getState().addNotification(`🔗 Deep link: ${data.path || data.uri}`);
        });

        // Listen for shared content from other apps
        await GIAIntent.addListener('onShareReceived', (data) => {
          logger.log('[NativeIntents] Shared content received:', data.mimeType);

          if (data.mimeType?.startsWith('text/') && data.text) {
            // Clean up shared text (remove URL prefix from share intents)
            let text = data.text;
            // When sharing from browser, Android often appends the URL
            const urlMatch = text.match(/^(.*?)\nhttps?:\/\/\S+$/s);
            if (urlMatch && urlMatch[1].trim()) {
              text = urlMatch[1].trim();
            }
            useGiaStore.getState().setPendingInput(text);
          } else if (data.imageUri) {
            useGiaStore.getState().setPendingAction({
              type: 'shared-image',
              data: { uri: data.imageUri, mimeType: data.mimeType },
            });
          }

          useGiaStore.getState().setModule('chat');
          useGiaStore.getState().addNotification('📩 Content received from another app');
        });
      } catch (e) {
        logger.warn('[NativeIntents] Setup failed:', e);
      }
    };

    init();

    return () => {
      GIAIntent.removeAllListeners().catch(() => {});
    };
  }, []);

  // Re-check for pending intent when the app regains focus
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        GIAIntent.getPendingIntent().then(pending => {
          if (pending.action) {
            handleIntentAction(pending.action, pending);
            GIAIntent.clearIntent();
          }
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);
}

interface IntentData {
  text?: string;
  urls?: string[];
  uri?: string;
  [key: string]: unknown;
}

function handleIntentAction(action: string, data: IntentData) {
  // Deduplicate: only handle fresh intents
  const { pendingInput, pendingAction } = useGiaStore.getState();
  if (pendingInput || pendingAction) return;

  if (action === 'android.intent.action.SEND') {
    let text = data.text || '';
    if (text) {
      const urlMatch = text.match(/^(.*?)\nhttps?:\/\/\S+$/s);
      if (urlMatch && urlMatch[1].trim()) {
        text = urlMatch[1].trim();
      }
      useGiaStore.getState().setPendingInput(text);
      useGiaStore.getState().setModule('chat');
    }
  } else if (data.uri?.startsWith('gia:') || data.uri?.startsWith('giap:') || data.uri?.startsWith('web+gian:')) {
    useGiaStore.getState().setPendingAction({
      type: 'deep-link',
      data: { url: data.uri },
    });
    useGiaStore.getState().setModule('chat');
  }
}
