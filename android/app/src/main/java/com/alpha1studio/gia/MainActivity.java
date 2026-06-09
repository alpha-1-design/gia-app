package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(GIAWakeWordPlugin.class);
        registerPlugin(GIAIntentPlugin.class);
        registerPlugin(GIAOverlayPlugin.class);
        registerPlugin(GIASMSPlugin.class);
        registerPlugin(GIAAlarmPlugin.class);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }
}
