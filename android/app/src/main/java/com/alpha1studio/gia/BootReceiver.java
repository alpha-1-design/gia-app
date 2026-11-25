package com.alpha1studio.gia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Starts GIACoreService on boot (with wake word auto-start) — only when the
 * user actually enabled them; the saved settings are honoured instead of any
 * hardcoded defaults.
 * Also re-registers any pending alarms.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "GIABoot";
    private static final String PREFS = "gia_core";
    private static final String PREF_ENABLED = "enabled";
    /** Wake word settings persisted by GIAWakeWordService (configFrom/markDisabled). */
    private static final String WW_PREFS = "gia_wakeword";
    private static final String WW_PREF_ENABLED = "enabled";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            boolean coreEnabled;
            boolean wakeWordEnabled;
            try {
                SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                coreEnabled = prefs.getBoolean(PREF_ENABLED, false);
                wakeWordEnabled = context.getSharedPreferences(WW_PREFS, Context.MODE_PRIVATE)
                        .getBoolean(WW_PREF_ENABLED, false);
            } catch (Exception e) {
                // Unreadable prefs: never auto-start anything at boot.
                Log.w(TAG, "Could not read boot preferences; not auto-starting services", e);
                return;
            }

            if (!coreEnabled) {
                return;
            }

            // Start unified core service only after the user has enabled it.
            Intent serviceIntent = new Intent(context, GIACoreService.class);
            // Only pass startWakeWord=true when the user enabled wake word. No
            // keyword/sensitivity extras: GIAWakeWordService.configFrom()
            // rebuilds the full config (saved keyword, sensitivity,
            // customModelPath, emitScores) from its own preferences.
            serviceIntent.putExtra("startWakeWord", wakeWordEnabled);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            // Re-register alarms
            GIAAlarmPlugin.reRegisterAlarms(context);
        }
    }
}
