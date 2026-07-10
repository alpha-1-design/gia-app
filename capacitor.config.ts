import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alpha1studio.gia',
  appName: 'GIA',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // IMPORTANT: keep this disabled. CapacitorHttp routes every fetch()/XHR
    // call through Android's native HTTP bridge instead of the WebView's own
    // network stack. That bridge buffers the entire response natively and
    // only hands it to JS once the request is fully complete — there is no
    // way to get incremental progress events through it. With this enabled,
    // GIA's streaming responses (and the "thinking"/token-by-token reveal)
    // silently degrade into "nothing happens, then the whole answer appears
    // at once" — exactly the reported bug. It was almost certainly turned on
    // to route around a CORS failure at some point, but the app already has
    // a dedicated fallback for that (see src/services/CorsProxy.ts /
    // corsProxy.fetch), so it doesn't need this blanket, streaming-breaking
    // workaround.
    CapacitorHttp: {
      enabled: false,
    },
  },
};

export default config;
