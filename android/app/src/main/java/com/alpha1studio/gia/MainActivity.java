package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // registerPlugin() must run BEFORE super.onCreate(): BridgeActivity's own
        // onCreate() builds the Bridge (via this.load()) and reads whatever plugins
        // are registered at that exact moment. Anything registered after
        // super.onCreate() returns is too late — the Bridge is already built and
        // those plugins are simply invisible to the JS side from then on, which is
        // what was producing "plugin is not implemented on android" for
        // GIATerminal with no crash or error anywhere to point at it.
        registerPlugin(GIAWakeWordPlugin.class);
        registerPlugin(GIAIntentPlugin.class);
        registerPlugin(GIAOverlayPlugin.class);
        registerPlugin(GIASMSPlugin.class);
        registerPlugin(GIAAlarmPlugin.class);
        registerPlugin(GIATerminalPlugin.class);
        registerPlugin(GIAMediaPlugin.class);
        registerPlugin(GIAUpdatePlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onPause() {
        super.onPause();
        // If GIACoreService is in keep-alive mode, resume WebView timers
        // so Telegram polling and background JS continue running.
        if (GIACoreService.isKeepAlive() && getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().resumeTimers();
            Log.d(TAG, "Keep-alive active — resumed WebView timers after pause");
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
