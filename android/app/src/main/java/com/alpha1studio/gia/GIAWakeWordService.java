package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.k2fsa.sherpa.onnx.KeywordSpotter;
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig;
import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * Background wake word detection using sherpa-onnx (fully on-device, no API key).
 *
 * The keyword spotter model is bundled in assets/wakeword/. Because the native
 * library needs real file paths (it cannot read Android assets directly), the
 * model files are copied to getFilesDir()/wakeword/ on first start.
 *
 * Supported wake words (see keywords.txt, tokenized with the model's BPE):
 *   "HEY JARVIS" (default), "HEY GIA", "HELLO WORLD", "HI GOOGLE",
 *   "HEY SIRI", "ALEXA"
 */
public class GIAWakeWordService extends Service {

    private static final String TAG = "GIAWakeWord";
    private static final String CHANNEL_ID = "GIAWakeWordChannel";
    private static final int NOTIFICATION_ID = 1001;
    private static final int ERROR_NOTIFICATION_ID = 1002;

    private static final int SAMPLE_RATE = 16000;
    // 0.1 seconds of audio per read (1600 samples at 16 kHz)
    private static final int CHUNK_SAMPLES = 1600;

    private static volatile boolean isRunning = false;
    private static volatile GIAWakeWordPlugin pluginRef = null;
    private static volatile String pendingKeyword = "";

    /** Maps the tokenized keyword phrases (as written in keywords.txt) to readable labels. */
    private static final Map<String, String> KEYWORD_LABELS = new HashMap<>();

    static {
        KEYWORD_LABELS.put("\u2581HE Y \u2581JA R VI S", "HEY JARVIS");
        KEYWORD_LABELS.put("\u2581HE Y \u2581G IA", "HEY GIA");
        KEYWORD_LABELS.put("\u2581HE LL O \u2581WORLD", "HELLO WORLD");
        KEYWORD_LABELS.put("\u2581HI \u2581GO O G LE", "HI GOOGLE");
        KEYWORD_LABELS.put("\u2581HE Y \u2581S I RI", "HEY SIRI");
        KEYWORD_LABELS.put("\u2581A LE X A", "ALEXA");
    }

    private static final String[] MODEL_FILES = {
        "encoder-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        "decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
        "joiner-epoch-12-avg-2-chunk-16-left-64.int8.onnx",
        "tokens.txt",
        "keywords.txt",
    };

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

    private String keyword = "JARVIS";
    private KeywordSpotter keywordSpotter;
    private AudioRecord audioRecord;
    private Thread listenThread;
    private volatile boolean listening = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("keyword")) {
            keyword = intent.getStringExtra("keyword");
        }

        Notification notification = buildNotification();
        try {
            startForeground(NOTIFICATION_ID, notification);
        } catch (SecurityException e) {
            android.util.Log.e(TAG, "startForeground failed: " + e.getMessage());
            notifyWakeWordError("Foreground service permission denied");
            stopSelf();
            return START_NOT_STICKY;
        }

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
        File modelDir = new File(getFilesDir(), "wakeword");
        if (!ensureModelFiles(modelDir)) {
            notifyWakeWordError("Wake word model files missing");
            stopSelf();
            return;
        }

        try {
            String encoder = new File(modelDir, MODEL_FILES[0]).getAbsolutePath();
            String decoder = new File(modelDir, MODEL_FILES[1]).getAbsolutePath();
            String joiner = new File(modelDir, MODEL_FILES[2]).getAbsolutePath();
            String tokens = new File(modelDir, MODEL_FILES[3]).getAbsolutePath();
            String keywordsFile = new File(modelDir, MODEL_FILES[4]).getAbsolutePath();

            OnlineTransducerModelConfig transducer = OnlineTransducerModelConfig.builder()
                .setEncoder(encoder)
                .setDecoder(decoder)
                .setJoiner(joiner)
                .build();

            OnlineModelConfig modelConfig = OnlineModelConfig.builder()
                .setTransducer(transducer)
                .setTokens(tokens)
                .setNumThreads(2)
                .setDebug(false)
                .build();

            KeywordSpotterConfig config = KeywordSpotterConfig.builder()
                .setOnlineModelConfig(modelConfig)
                .setKeywordsFile(keywordsFile)
                .build();

            keywordSpotter = new KeywordSpotter(config);
            startListeningThread();
        } catch (Exception e) {
            android.util.Log.e(TAG, "Wake word initialization failed: " + e.getMessage());
            e.printStackTrace();
            notifyWakeWordError("Wake word engine failed: " + e.getMessage());
            stopSelf();
        }
    }

    private boolean ensureModelFiles(File modelDir) {
        try {
            if (!modelDir.exists()) {
                modelDir.mkdirs();
            }
            for (String name : MODEL_FILES) {
                File out = new File(modelDir, name);
                if (out.exists() && out.length() > 0) {
                    continue;
                }
                copyAsset("wakeword/" + name, out);
            }
            return true;
        } catch (IOException e) {
            android.util.Log.e(TAG, "Failed to copy wake word model: " + e.getMessage());
            return false;
        }
    }

    private void copyAsset(String assetPath, File out) throws IOException {
        try (InputStream in = getAssets().open(assetPath);
             FileOutputStream fos = new FileOutputStream(out)) {
            byte[] buffer = new byte[8192];
            int n;
            while ((n = in.read(buffer)) > 0) {
                fos.write(buffer, 0, n);
            }
            fos.flush();
        }
    }

    private void startListeningThread() {
        listening = true;
        listenThread = new Thread(this::audioLoop, "GIAWakeWordListen");
        listenThread.start();
    }

    private void audioLoop() {
        int minBuffer = AudioRecord.getMinBufferSize(
            SAMPLE_RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        int bufferSize = Math.max(minBuffer, CHUNK_SAMPLES * 2);

        try {
            // VOICE_RECOGNITION source disables AGC/noise suppression, which
            // would otherwise distort the stream for keyword spotting.
            audioRecord = new AudioRecord(
                MediaRecorder.AudioSource.VOICE_RECOGNITION,
                SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufferSize
            );
        } catch (Exception e) {
            android.util.Log.e(TAG, "Failed to open AudioRecord: " + e.getMessage());
            notifyWakeWordError("Microphone unavailable: " + e.getMessage());
            stopSelf();
            return;
        }

        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            notifyWakeWordError("Microphone unavailable");
            audioRecord.release();
            audioRecord = null;
            stopSelf();
            return;
        }

        OnlineStream stream = keywordSpotter.createStream();
        byte[] byteBuffer = new byte[CHUNK_SAMPLES * 2];
        float[] sampleBuffer = new float[CHUNK_SAMPLES];

        audioRecord.startRecording();
        while (listening && keywordSpotter != null) {
            int n = audioRecord.read(byteBuffer, 0, byteBuffer.length);
            if (n <= 0) {
                continue;
            }
            int numSamples = n / 2;
            for (int i = 0; i < numSamples; ++i) {
                short low = byteBuffer[2 * i];
                short high = byteBuffer[2 * i + 1];
                int s = (high << 8) + low;
                sampleBuffer[i] = (float) s / 32768f;
            }

            stream.acceptWaveform(sampleBuffer, SAMPLE_RATE);

            while (keywordSpotter.isReady(stream)) {
                keywordSpotter.decode(stream);
                String tokenized = keywordSpotter.getResult(stream).getKeyword();
                if (!tokenized.isEmpty()) {
                    keywordSpotter.reset(stream);
                    onWakeWordDetected(toReadableLabel(tokenized));
                }
            }
        }

        try {
            audioRecord.stop();
        } catch (IllegalStateException ignored) {
        }
        audioRecord.release();
        audioRecord = null;
        stream.release();
    }

    private String toReadableLabel(String tokenized) {
        String label = KEYWORD_LABELS.get(tokenized);
        if (label != null) {
            return label;
        }
        // Fall back to whatever the user configured (e.g. JARVIS) for
        // unrecognized/custom keyword files.
        return keyword != null ? keyword : "WAKE WORD";
    }

    private void stopWakeWordDetection() {
        listening = false;
        Thread thread = listenThread;
        if (thread != null && thread.isAlive()) {
            try {
                thread.join(2000);
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
        listenThread = null;

        AudioRecord recorder = audioRecord;
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (IllegalStateException ignored) {
            }
            recorder.release();
            audioRecord = null;
        }

        if (keywordSpotter != null) {
            try {
                keywordSpotter.release();
            } catch (Exception ignored) {
            }
            keywordSpotter = null;
        }
    }

    private void notifyWakeWordError(String message) {
        GIAWakeWordPlugin ref = pluginRef;
        if (ref != null) {
            try {
                ref.notifyWakeWordError(message);
            } catch (Exception ignored) {
            }
        }
    }

    private void onWakeWordDetected(String detectedKeyword) {
        pendingKeyword = detectedKeyword;
        GIAWakeWordPlugin ref = pluginRef;
        if (ref != null) {
            try {
                ref.onWakeWordDetected();
            } catch (Exception ignored) {
            }
        }

        try {
            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launchIntent.putExtra("wakeWordDetected", true);
            launchIntent.putExtra("wakeWordKeyword", detectedKeyword);
            startActivity(launchIntent);
        } catch (Exception ignored) {
        }
    }
}