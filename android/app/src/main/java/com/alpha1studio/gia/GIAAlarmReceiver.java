package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;

import androidx.core.app.NotificationCompat;

public class GIAAlarmReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "GIAAlarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP, "GIA:AlarmLock");
                wakeLock.acquire(10000);
            }
        } catch (Exception ignored) {}

        String label = intent.getStringExtra("label");
        if (label == null) label = "Alarm";
        int requestCode = intent.getIntExtra("requestCode", 0);

        createChannel(context);

        Intent tapIntent = new Intent(context, MainActivity.class);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        tapIntent.putExtra("alarmLabel", label);

        PendingIntent pendingIntent = PendingIntent.getActivity(context, requestCode, tapIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Intent snoozeIntent = new Intent(context, GIAAlarmReceiver.class);
        snoozeIntent.putExtra("snooze", true);
        snoozeIntent.putExtra("label", label);
        snoozeIntent.putExtra("requestCode", requestCode);
        PendingIntent snoozePending = PendingIntent.getBroadcast(context, requestCode + 1000, snoozeIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        Uri alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarmSound == null) {
            alarmSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setContentTitle("⏰ " + label)
            .setContentText("Alarm is ringing!")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(pendingIntent, true)
            .setSound(alarmSound)
            .setVibrate(new long[]{0, 500, 500, 500, 500, 500})
            .addAction(android.R.drawable.ic_lock_idle_alarm, "Snooze 5 min", snoozePending)
            .build();

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(requestCode, notification);
        }

        if (wakeLock != null && wakeLock.isHeld()) {
            try { wakeLock.release(); } catch (Exception ignored) {}
        }
    }

    private void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "GIA Alarms",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Alarms set through GIA");
        channel.enableVibration(true);
        channel.setBypassDnd(true);
        channel.setShowBadge(true);
        channel.setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
            Notification.AUDIO_ATTRIBUTES_DEFAULT);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.createNotificationChannel(channel);
    }
}
