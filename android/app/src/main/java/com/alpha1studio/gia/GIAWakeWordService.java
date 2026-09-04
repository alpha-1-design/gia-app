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

/**
 * Placeholder for the on-device wake word service.
 *
 * The full implementation used sherpa-onnx (KeywordSpotter) for fully
 * on-device, keyless "Hey Jarvis" / "Hey GIA" detection. It was deferred
 * to a later release because the sherpa-onnx 1.13.7 Java API changed and
 * broke the APK build. The JS-side plugin surface (GIAWakeWord.ts) and the
 * Capacitor plugin (GIAWakeWordPlugin.java) are unchanged, so re-enabling
 * only needs this class restored.
 *
 * To revive in a later release:
 *   1. Restore this file from git history
 *      (git show <sha>:android/app/src/main/java/com/alpha1studio/gia/GIAWakeWordService.java)
 *      against the current sherpa-onnx API: new KeywordSpotter(AssetManager,
 *      KeywordSpotterConfig) and createStream(String) / createStream(long, String).
 *   2. Re-add the AAR dependency in android/app/build.gradle:
 *      implementation files('libs/sherpa-onnx-<version>.aar')
 *   3. Re-add the model assets under android/app/src/main/assets/wakeword/
 *      (encoder/decoder/joiner .onnx, tokens.txt, keywords.txt) and the
 *      <service android:name=".GIAWakeWordService"> entry in AndroidManifest.xml.
 */
public class GIAWakeWordService extends Service {

    private static final String TAG = "GIAWakeWord";
    private static final String CHANNEL_ID = "GIAWakeWordChannel";
    private static final int NOTIFICATION_ID = 1001;

    private static volatile boolean isRunning = false;
    private static volatile GIAWakeWordPlugin pluginRef = null;
    private static volatile String pendingKeyword = "";

    public static boolean isRunning() {
        return isRunning;
    }

    public static String getPendingKeyword() {
        String kw = pendingKeyword;
        pendingKeyword = "";
        return kw;
    }

    public static void setPluginRef(GIAWakeWordPlugin plugin) {
        pluginRef = plugin;
    }

    public static void clearPluginRef() {
        pluginRef = null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Wake word engine intentionally disabled for this release.
        //
        // GIACoreService / GIAWakeWordPlugin start this with
        // startForegroundService(), which requires a startForeground() call
        // or Android throws. Enter the foreground briefly, then stop.
        try {
            startForeground(NOTIFICATION_ID, buildNotification());
        } catch (Exception e) {
            android.util.Log.w(TAG, "startForeground failed: " + e.getMessage());
        }
        isRunning = false;
        notifyWakeWordError("Wake word detection is disabled in this build");
        stopSelf();
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
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
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GIA")
            .setContentText("Wake word disabled")
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build();
    }

    void notifyWakeWordError(String message) {
        GIAWakeWordPlugin ref = pluginRef;
        if (ref != null) {
            try {
                ref.notifyWakeWordError(message);
            } catch (Exception ignored) {
            }
        }
    }
}
