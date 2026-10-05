package com.alpha1studio.gia;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.content.res.AssetManager;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * On-device, keyless wake word detection using openWakeWord
 * (https://github.com/dscripka/openWakeWord) on ONNX Runtime.
 *
 * Models live in assets/wakeword/:
 *   melspectrogram.onnx, embedding_model.onnx   shared feature extractor
 *   <keyword>_v0.1.onnx                         one classifier per wake phrase
 * Any extra classifier dropped into that folder is discovered automatically
 * (see {@link #listKeywords}). A classifier outside the APK can be supplied by
 * absolute path through "customModelPath".
 *
 * The microphone is released while the app is capturing the user's request
 * (pause/resume) so it never fights SpeechRecognizer for the input.
 */
public class GIAWakeWordService extends Service {

    private static final String TAG = "GIAWakeWord";
    private static final String CHANNEL_ID = "GIAWakeWordChannel";
    private static final int NOTIFICATION_ID = 1001;
    private static final String ASSET_DIR = "wakeword";
    private static final String MEL_ASSET = "melspectrogram.onnx";
    private static final String EMB_ASSET = "embedding_model.onnx";
    private static final String PREFS = "gia_wakeword";
    private static final long AUTO_RESUME_MS = 20_000;
    private static final long COOLDOWN_MS = 2_000;
    private static final int SAMPLE_RATE = 16_000;
    private static final int MAX_MIC_FAILURES = 5;

    // ── Shared state (read by the Capacitor plugin) ──────────────────────
    private static volatile boolean running = false;
    private static volatile boolean paused = false;
    private static volatile boolean appInForeground = false;
    private static volatile String activeLabel = "";
    private static volatile float activeThreshold = 0f;
    private static volatile float lastScore = 0f;
    private static volatile String lastError = "";
    private static volatile String pendingKeyword = "";
    private static volatile GIAWakeWordPlugin pluginRef = null;

    public static boolean isRunning() { return running; }
    public static boolean isPaused() { return paused; }
    public static String getActiveLabel() { return activeLabel; }
    public static float getActiveThreshold() { return activeThreshold; }
    public static float getLastScore() { return lastScore; }
    public static String getLastError() { return lastError; }
    public static void setAppInForeground(boolean fg) { appInForeground = fg; }
    public static void setPluginRef(GIAWakeWordPlugin plugin) { pluginRef = plugin; }
    public static void clearPluginRef() { pluginRef = null; }

    /** Returns and clears the detection that happened while no UI was attached. */
    public static String getPendingKeyword() {
        String kw = pendingKeyword;
        pendingKeyword = "";
        return kw;
    }

    // ── Pause / resume (mic hand-off to SpeechRecognizer) ────────────────
    private static final Object pauseLock = new Object();
    private static volatile long autoResumeAt = 0;

    /** Releases the microphone until {@link #resumeCapture()} or the safety timeout. */
    public static void pauseCapture() {
        synchronized (pauseLock) {
            paused = true;
            autoResumeAt = SystemClock.elapsedRealtime() + AUTO_RESUME_MS;
            pauseLock.notifyAll();
        }
    }

    public static void resumeCapture() {
        synchronized (pauseLock) {
            paused = false;
            pauseLock.notifyAll();
        }
    }

    // ── Model discovery ──────────────────────────────────────────────────

    /** Keyword ids bundled in assets/wakeword/, e.g. "hey_jarvis". */
    public static List<String> listKeywords(Context ctx) {
        List<String> ids = new ArrayList<>();
        try {
            String[] files = ctx.getAssets().list(ASSET_DIR);
            if (files != null) {
                for (String f : files) {
                    if (!f.endsWith(".onnx") || f.equals(MEL_ASSET) || f.equals(EMB_ASSET)) continue;
                    ids.add(keywordId(f));
                }
            }
        } catch (IOException e) {
            Log.w(TAG, "Could not list wake word assets", e);
        }
        return ids;
    }

    /** "hey_jarvis_v0.1.onnx" -> "hey_jarvis" */
    static String keywordId(String fileName) {
        String base = fileName.endsWith(".onnx") ? fileName.substring(0, fileName.length() - 5) : fileName;
        return base.replaceAll("_v\\d+(\\.\\d+)*$", "");
    }

    /** "hey_jarvis" -> "Hey Jarvis" */
    static String displayLabel(String id) {
        StringBuilder sb = new StringBuilder();
        for (String part : id.split("_")) {
            if (part.isEmpty()) continue;
            if (sb.length() > 0) sb.append(' ');
            sb.append(part.substring(0, 1).toUpperCase(Locale.ROOT)).append(part.substring(1));
        }
        return sb.toString();
    }

    /** Resolves what the UI asked for ("JARVIS", "hey jarvis", ...) to a bundled keyword id. */
    static String resolveKeywordId(List<String> available, String requested) {
        if (available.isEmpty()) return null;
        String want = requested == null ? "" : requested.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
        if (!want.isEmpty()) {
            for (String id : available) if (id.equals(want)) return id;
            for (String id : available) if (id.endsWith("_" + want) || id.contains(want)) return id;
        }
        return available.get(0);
    }

    // ── Worker ───────────────────────────────────────────────────────────

    private static final class Config {
        String keyword;
        String customModelPath;
        float sensitivity;
        boolean emitScores;
    }

    private Thread worker;
    /** One flag per worker, so a slow-to-die old worker can never stop its replacement. */
    private AtomicBoolean workerStop = new AtomicBoolean(false);

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Android kills the app if startForeground() isn't called promptly after
        // startForegroundService(), even when we're about to stop again - so do it first.
        try {
            Notification n = buildNotification("Starting…");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
        } catch (Exception e) {
            // Android 12+ blocks microphone foreground services started from the background.
            fail("Android blocked the microphone service: " + e.getMessage());
            stopSelf();
            return START_NOT_STICKY;
        }

        Config cfg = configFrom(intent);
        if (cfg == null) {
            // Started without settings (e.g. by GIACoreService) and the user never enabled wake word.
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            fail("Microphone permission is not granted");
            stopSelf();
            return START_NOT_STICKY;
        }

        stopWorker();
        lastError = "";
        paused = false;
        final Config finalCfg = cfg;
        final AtomicBoolean stopFlag = new AtomicBoolean(false);
        workerStop = stopFlag;
        worker = new Thread(() -> runLoop(finalCfg, stopFlag), "GIAWakeWord");
        worker.setPriority(Thread.NORM_PRIORITY + 1);
        worker.start();
        return START_STICKY;
    }

    private Config configFrom(Intent intent) {
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        Config cfg = new Config();
        if (intent != null && intent.hasExtra("sensitivity")) {
            cfg.keyword = intent.getStringExtra("keyword");
            cfg.customModelPath = intent.getStringExtra("customModelPath");
            cfg.sensitivity = intent.getFloatExtra("sensitivity", 0.7f);
            cfg.emitScores = intent.getBooleanExtra("emitScores", false);
            prefs.edit()
                    .putString("keyword", cfg.keyword)
                    .putString("customModelPath", cfg.customModelPath)
                    .putFloat("sensitivity", cfg.sensitivity)
                    .putBoolean("emitScores", cfg.emitScores)
                    .putBoolean("enabled", true)
                    .apply();
            return cfg;
        }
        if (!prefs.getBoolean("enabled", false)) return null;
        cfg.keyword = prefs.getString("keyword", "");
        cfg.customModelPath = prefs.getString("customModelPath", "");
        cfg.sensitivity = prefs.getFloat("sensitivity", 0.7f);
        cfg.emitScores = prefs.getBoolean("emitScores", false);
        return cfg;
    }

    private void runLoop(Config cfg, AtomicBoolean stop) {
        OrtBackend backend = null;
        AudioRecord recorder = null;
        try {
            byte[] classifier;
            String label;
            if (cfg.customModelPath != null && !cfg.customModelPath.isEmpty()) {
                File f = new File(cfg.customModelPath);
                classifier = readStream(new FileInputStream(f));
                label = displayLabel(keywordId(f.getName()));
            } else {
                List<String> ids = listKeywords(this);
                String id = resolveKeywordId(ids, cfg.keyword);
                if (id == null) throw new IOException("No wake word models are bundled in this build");
                classifier = readAsset(findClassifierAsset(id));
                label = displayLabel(id);
            }

            backend = new OrtBackend(readAsset(MEL_ASSET), readAsset(EMB_ASSET), classifier);
            OpenWakeWordEngine engine = new OpenWakeWordEngine(backend);
            engine.setThreshold(OpenWakeWordEngine.thresholdForSensitivity(cfg.sensitivity));
            engine.setCooldownMs(COOLDOWN_MS);

            activeLabel = label;
            activeThreshold = engine.getThreshold();
            running = true;
            updateNotification("Listening for \"" + label + "\"");
            Log.i(TAG, "Listening for \"" + label + "\" at threshold " + activeThreshold);

            short[] frame = new short[OpenWakeWordEngine.FRAME_SAMPLES];
            int micFailures = 0;
            int frameCounter = 0;

            while (!stop.get()) {
                if (paused) {
                    if (recorder != null) { releaseRecorder(recorder); recorder = null; }
                    waitWhilePaused(stop);
                    engine.reset();   // audio history is stale after the pause
                    continue;
                }

                if (recorder == null) {
                    recorder = openRecorder();
                    if (recorder == null) {
                        if (++micFailures >= MAX_MIC_FAILURES) {
                            throw new IOException("Could not open the microphone (is another app using it?)");
                        }
                        Thread.sleep(1000L * micFailures);
                        continue;
                    }
                    micFailures = 0;
                }

                if (!readFully(recorder, frame)) {
                    releaseRecorder(recorder);
                    recorder = null;
                    continue;
                }

                float score = engine.process(frame);
                lastScore = score;
                if (cfg.emitScores && ++frameCounter % 3 == 0) {
                    GIAWakeWordPlugin ref = pluginRef;
                    if (ref != null) ref.notifyWakeWordScore(score);
                }

                if (engine.shouldTrigger(score, SystemClock.elapsedRealtime())) {
                    onDetected(label, score);
                }
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        } catch (Throwable t) {
            Log.e(TAG, "Wake word loop failed", t);
            fail(t.getClass().getSimpleName() + ": " + t.getMessage());
        } finally {
            if (recorder != null) releaseRecorder(recorder);
            if (backend != null) backend.close();
            running = false;
            activeLabel = "";
            if (!stop.get()) stopSelf();   // died on its own: don't leave a dead notification
        }
    }

    private void onDetected(String label, float score) {
        Log.i(TAG, String.format(Locale.ROOT, "Detected \"%s\" (score %.2f)", label, score));
        pendingKeyword = label;
        pauseCapture();   // hand the mic to SpeechRecognizer

        GIAWakeWordPlugin ref = pluginRef;
        if (appInForeground && ref != null) {
            pendingKeyword = "";
            ref.onWakeWordDetected(label, score);
            return;
        }

        // App is in the background: bring it forward; the plugin delivers the
        // event from handleOnNewIntent (or getPendingWakeWord on a cold start).
        // Android 10+ silently ignores background activity starts unless the app
        // holds an exemption (e.g. draw-over-apps), so also post a notification
        // that carries the same intent as a full-screen intent. Either one works.
        Intent launch = new Intent(this, MainActivity.class);
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        launch.putExtra("wakeWordDetected", true);
        launch.putExtra("wakeWordKeyword", label);
        launch.putExtra("wakeWordScore", score);
        postTapToTalkNotification(launch, label);
        try {
            startActivity(launch);
        } catch (Exception e) {
            Log.w(TAG, "Background launch blocked; relying on the notification", e);
        }
    }

    private void postTapToTalkNotification(Intent launch, String label) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        PendingIntent pi = PendingIntent.getActivity(this, 7, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Heard \"" + label + "\"")
                .setContentText("Tap to talk to GIA")
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setFullScreenIntent(pi, true)
                .setAutoCancel(true)
                .setContentIntent(pi)
                .build();
        nm.notify(NOTIFICATION_ID + 1, n);
    }

    private void waitWhilePaused(AtomicBoolean stop) throws InterruptedException {
        synchronized (pauseLock) {
            while (paused && !stop.get()) {
                long left = autoResumeAt - SystemClock.elapsedRealtime();
                if (left <= 0) { paused = false; break; }
                pauseLock.wait(left);
            }
        }
    }

    private AudioRecord openRecorder() {
        int min = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (min <= 0) return null;
        int bufBytes = Math.max(min, OpenWakeWordEngine.FRAME_SAMPLES * 2 * 4);
        try {
            AudioRecord r = new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, bufBytes);
            if (r.getState() != AudioRecord.STATE_INITIALIZED) {
                r.release();
                return null;
            }
            r.startRecording();
            if (r.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                r.release();
                return null;
            }
            return r;
        } catch (SecurityException | IllegalStateException e) {
            Log.w(TAG, "AudioRecord unavailable", e);
            return null;
        }
    }

    private static boolean readFully(AudioRecord r, short[] dst) {
        int off = 0;
        while (off < dst.length) {
            int n = r.read(dst, off, dst.length - off);
            if (n <= 0) return false;   // error or recorder stopped
            off += n;
        }
        return true;
    }

    private static void releaseRecorder(AudioRecord r) {
        try { r.stop(); } catch (IllegalStateException ignored) { }
        r.release();
    }

    private void stopWorker() {
        workerStop.set(true);
        synchronized (pauseLock) { pauseLock.notifyAll(); }
        Thread t = worker;
        if (t != null) {
            t.interrupt();
            try { t.join(1500); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
        }
        worker = null;
    }

    private void fail(String message) {
        lastError = message;
        GIAWakeWordPlugin ref = pluginRef;
        if (ref != null) {
            try { ref.notifyWakeWordError(message); } catch (Exception ignored) { }
        }
    }

    // ── Asset helpers ────────────────────────────────────────────────────

    private String findClassifierAsset(String id) throws IOException {
        String[] files = getAssets().list(ASSET_DIR);
        if (files != null) {
            for (String f : files) {
                if (f.endsWith(".onnx") && keywordId(f).equals(id)) return f;
            }
        }
        throw new IOException("Missing model for " + id);
    }

    private byte[] readAsset(String name) throws IOException {
        AssetManager am = getAssets();
        return readStream(am.open(ASSET_DIR + "/" + name));
    }

    private static byte[] readStream(InputStream in) throws IOException {
        try (InputStream is = in; ByteArrayOutputStream out = new ByteArrayOutputStream(1 << 20)) {
            byte[] buf = new byte[16 * 1024];
            int n;
            while ((n = is.read(buf)) > 0) out.write(buf, 0, n);
            return out.toByteArray();
        }
    }

    // ── Lifecycle / notification ─────────────────────────────────────────

    @Override
    public void onDestroy() {
        stopWorker();
        running = false;
        super.onDestroy();
    }

    /** Called by the plugin for an explicit stop so the system doesn't resurrect us. */
    static void markDisabled(Context ctx) {
        ctx.getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("enabled", false).apply();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Wake Word Detection", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("GIA is listening for the wake word");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification(String text) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("GIA")
                .setContentText(text)
                .setSmallIcon(android.R.drawable.ic_btn_speak_now)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .setContentIntent(pi)
                .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(text));
    }
}
