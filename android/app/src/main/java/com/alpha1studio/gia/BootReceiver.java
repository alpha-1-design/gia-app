package com.alpha1studio.gia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Starts GIACoreService on boot (with wake word auto-start).
 * Also re-registers any pending alarms.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {

            // Start unified core service with wake word
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
