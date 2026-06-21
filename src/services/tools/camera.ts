import { Camera, CameraResultType } from '@capacitor/camera';
import { useGiaStore } from '../../store/useGiaStore';
import type { Tool } from './types';

// Hold the last captured photo data for the UI to pick up
let lastCapturedImage: { name: string; type: string; dataUrl: string } | null = null;
let capturedResolve: ((img: { name: string; type: string; dataUrl: string } | null) => void) | null = null;

export function consumeLastCapturedImage() {
  const img = lastCapturedImage;
  lastCapturedImage = null;
  return img;
}

export function waitForCapturedImage(timeoutMs = 30000): Promise<{ name: string; type: string; dataUrl: string } | null> {
  if (lastCapturedImage) {
    const img = lastCapturedImage;
    lastCapturedImage = null;
    return Promise.resolve(img);
  }
  return new Promise(resolve => {
    capturedResolve = resolve;
    setTimeout(() => { capturedResolve = null; resolve(null); }, timeoutMs);
  });
}

const capture_photo: Tool = {
  id: 'capture_photo',
  name: 'capture_photo',
  description: 'Take a photo using the device camera. Returns image data for analysis. Works on Android (Capacitor) and web. Use when you need to see what the user is looking at.',
  schema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async () => {
    try {
      useGiaStore.getState().addNotification('📷 Opening camera...');
      useGiaStore.getState().setThinkingPhase('processing');
      const image = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        quality: 85,
        allowEditing: false,
        saveToGallery: false,
      });
      if (!image.dataUrl) {
        return { success: false, content: '', error: 'No image captured' };
      }
      const name = `camera-${Date.now()}.${image.format || 'jpg'}`;
      const type = `image/${image.format || 'jpeg'}`;
      const dataUrl = image.dataUrl;

      // Store for UI attachment list and brain consumption
      lastCapturedImage = { name, type, dataUrl };
      if (capturedResolve) {
        capturedResolve(lastCapturedImage);
        capturedResolve = null;
      }

      useGiaStore.getState().addNotification('📸 Photo captured');
      return {
        success: true,
        content: `Captured photo (${(dataUrl.length * 0.75 / 1024).toFixed(0)} KB). The image has been added to the conversation.`,
      };
    } catch (e) {
      if (e instanceof Error && e.message === 'User cancelled photos app') {
        return { success: false, content: '', error: 'User cancelled camera capture' };
      }
      return { success: false, content: '', error: e instanceof Error ? e.message : 'Camera access failed' };
    }
  },
};

export const cameraTools: Tool[] = [capture_photo];
