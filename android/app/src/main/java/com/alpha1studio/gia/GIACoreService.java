package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Unified foreground service that holds the wake lock, monitors network,
 * manages wake word / autonomy / MediaProjection lifecycle, and exposes
 * status to the WebView via CorePlugin.
 *
 * Replaces the role of a standalone GIAWakeWordService (which is kept for
 * backward compat but preferably managed through this service).
 */
public class GIACoreService extends Service {

    private static final String TAG = "GIACoreService";
    private static final String CHANNEL_ID = "GIACoreChannel";
    private static final int NOTIFICATION_ID = 2001;

    // Wake lock
    private static final long WAKE_LOCK_WATCHDOG_MS = 5 * 60 * 1000L; // Re-acquire every 5 min
    private PowerManager.WakeLock wakeLock;
    private android.os.Handler wakeLockWatchdog;
    private Runnable wakeLockGuard;

    // Network monitor
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private volatile boolean isOnline;
    private volatile String networkType = "none";
    private volatile boolean isMetered;

    // Public state (read by CorePlugin)
    private static volatile boolean isRunning = false;
    private static volatile boolean keepAlive = false;
    private static volatile GIACoreService instance;

    // Autonomy tick interval (ms)
    private static final long AUTONOMY_HEARTBEAT_MS = 60_000L;

    public static boolean isRunning() { return isRunning; }
    public static boolean isKeepAlive() { return keepAlive; }
    public static GIACoreService getInstance() { return instance; }

    // ── Lifecycle ─────────────────────────────────────────────────────

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        keepAlive = false;
        createNotificationChannel();
        acquireWakeLock();
        registerNetworkMonitor();
        startWakeLockWatchdog();
        Log.i(TAG, "GIACoreService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);
        isRunning = true;
        Log.i(TAG, "GIACoreService foreground started");

        // Refresh network state immediately
        refreshNetworkState();

        // Optionally start wake word if auto-start is enabled
        if (intent != null && intent.getBooleanExtra("startWakeWord", false)) {
            startWakeWordService(intent);
        }

        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        keepAlive = false;
        instance = null;
        stopWakeLockWatchdog();
        releaseWakeLock();
        unregisterNetworkMonitor();
        super.onDestroy();
        Log.i(TAG, "GIACoreService destroyed");
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Wake Lock ──────────────────────────────────────────────────────

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "GIACoreService:WakeLock"
            );
            // Acquire indefinitely (watchdog re-acquires periodically)
            wakeLock.acquire();
            Log.d(TAG, "Wake lock acquired (indefinite)");
        }
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
            Log.d(TAG, "Wake lock released");
        }
    }

    private void startWakeLockWatchdog() {
        wakeLockWatchdog = new android.os.Handler(getMainLooper());
        wakeLockGuard = () -> {
            if (!isRunning) return;
            // Re-acquire wake lock to prevent OS from stripping it
            if (wakeLock != null && !wakeLock.isHeld()) {
                try {
                    wakeLock.acquire();
                    Log.d(TAG, "Wake lock re-acquired by watchdog");
                } catch (Exception e) {
                    Log.w(TAG, "Failed to re-acquire wake lock", e);
                }
            }
            wakeLockWatchdog.postDelayed(wakeLockGuard, WAKE_LOCK_WATCHDOG_MS);
        };
        wakeLockWatchdog.postDelayed(wakeLockGuard, WAKE_LOCK_WATCHDOG_MS);
    }

    private void stopWakeLockWatchdog() {
        if (wakeLockWatchdog != null && wakeLockGuard != null) {
            wakeLockWatchdog.removeCallbacks(wakeLockGuard);
        }
    }

    // ── Keep-Alive Mode ─────────────────────────────────────────────────

    /** Enable indefinite background mode (keeps WebView timers alive). */
    public void setKeepAlive(boolean enable) {
        keepAlive = enable;
        Log.i(TAG, "Keep-alive mode: " + (enable ? "ON" : "OFF"));
        // Refresh notification to show keep-alive status
        if (isRunning) {
            Notification notification = buildNotification();
            android.app.NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, notification);
            }
        }
    }

    // ── Network Monitor ────────────────────────────────────────────────

    private void registerNetworkMonitor() {
        connectivityManager = (ConnectivityManager) getSystemService(CONNECTIVITY_SERVICE);
        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                super.onAvailable(network);
                refreshNetworkState();
                broadcastNetworkChange();
            }

            @Override
            public void onLost(@NonNull Network network) {
                super.onLost(network);
                isOnline = false;
                broadcastNetworkChange();
            }

            @Override
            public void onCapabilitiesChanged(@NonNull Network network,
                                              @NonNull NetworkCapabilities caps) {
                super.onCapabilitiesChanged(network, caps);
                refreshNetworkState();
                broadcastNetworkChange();
            }
        };

        NetworkRequest request = new NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build();

        if (connectivityManager != null) {
            connectivityManager.registerNetworkCallback(request, networkCallback);
        }
    }

    private void unregisterNetworkMonitor() {
        if (connectivityManager != null && networkCallback != null) {
            connectivityManager.unregisterNetworkCallback(networkCallback);
        }
    }

    private void refreshNetworkState() {
        if (connectivityManager == null) return;
        Network active = connectivityManager.getActiveNetwork();
        NetworkCapabilities caps = connectivityManager.getNetworkCapabilities(active);

        isOnline = caps != null &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);

        if (caps != null) {
            if (caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                networkType = "wifi";
            } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)) {
                networkType = "cellular";
            } else if (caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)) {
                networkType = "ethernet";
            } else {
                networkType = "other";
            }
            isMetered = !caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);
        } else {
            networkType = "none";
            isMetered = false;
        }
    }

    private void broadcastNetworkChange() {
        Intent intent = new Intent("com.alpha1studio.gia.NETWORK_CHANGED");
        intent.putExtra("online", isOnline);
        intent.putExtra("type", networkType);
        intent.putExtra("metered", isMetered);
        sendBroadcast(intent);
    }

    // ── Public status accessors (for CorePlugin) ───────────────────────

    public boolean isOnline() { return isOnline; }
    public String getNetworkType() { return networkType; }
    public boolean isMetered() { return isMetered; }
    public boolean isWakeLockHeld() { return wakeLock != null && wakeLock.isHeld(); }

    // ── Wake word helper ──────────────────────────────────────────────

    private void startWakeWordService(Intent intent) {
        Intent wwIntent = new Intent(this, GIAWakeWordService.class);
        if (intent.hasExtra("accessKey"))
            wwIntent.putExtra("accessKey", intent.getStringExtra("accessKey"));
        if (intent.hasExtra("keyword"))
            wwIntent.putExtra("keyword", intent.getStringExtra("keyword"));
        if (intent.hasExtra("sensitivity"))
            wwIntent.putExtra("sensitivity", intent.getFloatExtra("sensitivity", 0.7f));
        if (intent.hasExtra("customModelPath"))
            wwIntent.putExtra("customModelPath", intent.getStringExtra("customModelPath"));
        startForegroundService(wwIntent);
    }

    // ── Notification ──────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "GIA Background Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("GIA is running in the background");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        StringBuilder sb = new StringBuilder();
        sb.append(isOnline ? "Online" : "Offline");
        if (!"none".equals(networkType)) {
            sb.append(" • ").append(networkType);
        }
        if (keepAlive) {
            sb.append(" • Background active");
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GIA")
            .setContentText(sb.toString())
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .setContentIntent(
                android.app.PendingIntent.getActivity(this, 0, tapIntent,
                    android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT)
            )
            .build();
    }
}
