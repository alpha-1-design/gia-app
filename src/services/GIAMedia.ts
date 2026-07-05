import { registerPlugin } from '@capacitor/core';

export interface GIAMediaPlugin {
  play(options: { path: string; title?: string; artist?: string; albumId?: number }): Promise<void>;
  playUri(options: { uri: string }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  seekTo(options: { position: number }): Promise<void>;
  getStatus(): Promise<{ isPlaying: boolean; currentPosition: number; duration: number; isRunning: boolean }>;
  listSongs(): Promise<{ songs: Array<{ path: string; title: string; artist: string; album: string; duration: number }>; count: number }>;
  searchSongs(options: { query: string }): Promise<{ songs: Array<{ path: string; title: string; artist: string; album: string; duration: number }>; count: number }>;
}

const GIAMedia = registerPlugin<GIAMediaPlugin>('GIAMedia', {
  web: () => import('./GIAMedia.web').then(m => m.GIAMediaWeb),
});

export { GIAMedia };
