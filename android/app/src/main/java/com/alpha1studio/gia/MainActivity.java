package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(GIAWakeWordPlugin.class);
        registerPlugin(GIAIntentPlugin.class);
        registerPlugin(GIAOverlayPlugin.class);
        registerPlugin(GIASMSPlugin.class);
        registerPlugin(GIAAlarmPlugin.class);
        registerPlugin(GIATerminalPlugin.class);
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
