package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import ai.picovoice.porcupine.Porcupine;
import ai.picovoice.porcupine.PorcupineManager;
import ai.picovoice.porcupine.PorcupineManagerCallback;
import ai.picovoice.porcupine.PorcupineException;

public class GIAWakeWordService extends Service {

    private static final String CHANNEL_ID = "GIAWakeWordChannel";
    private static final int NOTIFICATION_ID = 1001;
    private static volatile boolean isRunning = false;
    private static volatile GIAWakeWordPlugin pluginRef = null;

    public static boolean isRunning() {
        return isRunning;
    }

    public static void setPluginRef(GIAWakeWordPlugin plugin) {
        pluginRef = plugin;
    }

    public static void clearPluginRef() {
        pluginRef = null;
    }

    private String accessKey = "";
    private String keyword = "JARVIS";
    private float sensitivity = 0.7f;
    private String customModelPath = "";
    private PorcupineManager porcupineManager;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            if (intent.hasExtra("accessKey"))
                accessKey = intent.getStringExtra("accessKey");
            if (intent.hasExtra("keyword"))
                keyword = intent.getStringExtra("keyword");
            if (intent.hasExtra("sensitivity"))
                sensitivity = intent.getFloatExtra("sensitivity", 0.7f);
            if (intent.hasExtra("customModelPath"))
                customModelPath = intent.getStringExtra("customModelPath");
        }

        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);

        startWakeWordDetection();
        isRunning = true;
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        stopWakeWordDetection();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Wake Word Detection",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("GIA is listening for the wake word");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GIA")
            .setContentText("Listening\u2026")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build();
    }

    private void startWakeWordDetection() {
        try {
            PorcupineManagerCallback callback = keywordIndex -> onWakeWordDetected();

            PorcupineManager.Builder builder = new PorcupineManager.Builder()
                .setAccessKey(accessKey)
                .setSensitivity(sensitivity);

            if (!customModelPath.isEmpty()) {
                builder.setKeywordPaths(new String[]{customModelPath});
            } else {
                builder.setKeyword(parseBuiltInKeyword(keyword));
            }

            porcupineManager = builder.build(getApplicationContext(), callback);
            porcupineManager.start();
        } catch (PorcupineException e) {
            e.printStackTrace();
            stopSelf();
        }
    }

    private void stopWakeWordDetection() {
        if (porcupineManager != null) {
            try {
                porcupineManager.stop();
                porcupineManager.delete();
            } catch (PorcupineException e) {
                e.printStackTrace();
            }
            porcupineManager = null;
        }
    }

    private Porcupine.BuiltInKeyword parseBuiltInKeyword(String kw) {
        if (kw == null) return Porcupine.BuiltInKeyword.JARVIS;
        try {
            return Porcupine.BuiltInKeyword.valueOf(kw.toUpperCase());
        } catch (IllegalArgumentException e) {
            return Porcupine.BuiltInKeyword.JARVIS;
        }
    }

    private void onWakeWordDetected() {
        GIAWakeWordPlugin ref = pluginRef;
        if (ref != null) {
            try {
                ref.onWakeWordDetected();
            } catch (Exception ignored) {}
        }

        try {
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.putExtra("wakeWordDetected", true);
            launchIntent.putExtra("wakeWordKeyword", keyword);
            startActivity(launchIntent);
        } catch (Exception ignored) {}
    }
}
