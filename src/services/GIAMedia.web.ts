import type { GIAMediaPlugin } from './GIAMedia';

let webAudio: HTMLAudioElement | null = null;
let currentTitle = '';
let currentArtist = '';
let isPaused = false;

export const GIAMediaWeb: GIAMediaPlugin = {
  async play(options) {
    if (webAudio) {
      webAudio.pause();
      webAudio = null;
    }
    webAudio = new Audio(options.path);
    currentTitle = options.title || 'Unknown';
    currentArtist = options.artist || '';
    await webAudio.play();
    if (navigator.mediaSession) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTitle,
        artist: currentArtist || 'GIA Music',
      });
    }
  },

  async playUri(options) {
    if (webAudio) {
      webAudio.pause();
      webAudio = null;
    }
    webAudio = new Audio(options.uri);
    currentTitle = options.uri.substring(options.uri.lastIndexOf('/') + 1);
    currentArtist = '';
    await webAudio.play();
  },

  async pause() {
    if (webAudio && !webAudio.paused) {
      webAudio.pause();
      isPaused = true;
    }
  },

  async resume() {
    if (webAudio && isPaused) {
      await webAudio.play();
      isPaused = false;
    }
  },

  async stop() {
    if (webAudio) {
      webAudio.pause();
      webAudio = null;
    }
    isPaused = false;
  },

  async seekTo(options) {
    if (webAudio) {
      webAudio.currentTime = options.position / 1000;
    }
  },

  async getStatus() {
    if (!webAudio) {
      return { isPlaying: false, currentPosition: 0, duration: 0, isRunning: false };
    }
    return {
      isPlaying: !webAudio.paused,
      currentPosition: Math.floor(webAudio.currentTime * 1000),
      duration: Math.floor((webAudio.duration || 0) * 1000),
      isRunning: true,
    };
  },

  async listSongs() {
    return { songs: [], count: 0 };
  },

  async searchSongs(options: { query: string }): Promise<{ songs: never[]; count: number }> {
    void options;
    return { songs: [], count: 0 };
  },
};
