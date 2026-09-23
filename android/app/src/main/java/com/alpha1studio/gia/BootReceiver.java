package com.alpha1studio.gia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.content.SharedPreferences;

/**
 * Starts GIACoreService on boot (with wake word auto-start).
 * Also re-registers any pending alarms.
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String PREFS = "gia_core";
    private static final String PREF_ENABLED = "enabled";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (!prefs.getBoolean(PREF_ENABLED, false)) {
                return;
            }

            // Start unified core service only after the user has enabled it.
            Intent serviceIntent = new Intent(context, GIACoreService.class);
            serviceIntent.putExtra("startWakeWord", true);
            serviceIntent.putExtra("keyword", "JARVIS");
            serviceIntent.putExtra("sensitivity", 0.7f);

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
