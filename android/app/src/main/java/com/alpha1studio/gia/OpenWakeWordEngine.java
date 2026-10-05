package com.alpha1studio.gia;

/**
 * Streaming openWakeWord pipeline (https://github.com/dscripka/openWakeWord).
 *
 * <pre>
 *   16 kHz PCM16, 1280-sample (80 ms) frames
 *     -> melspectrogram.onnx   (+480 samples of left context -> 8 mel frames x 32 bins)
 *     -> x / 10 + 2            (the normalisation openWakeWord applies)
 *     -> rolling 76 x 32 window -> embedding_model.onnx -> 96-dim embedding
 *     -> rolling 16 x 96 window -> keyword classifier  -> score in [0, 1]
 * </pre>
 *
 * This class is deliberately free of Android and ONNX Runtime imports so the
 * buffer arithmetic can be unit-tested on a plain JVM; the three neural
 * networks are supplied through {@link Backend}.
 *
 * Not thread-safe: feed it from a single audio thread.
 */
public final class OpenWakeWordEngine {

    public static final int FRAME_SAMPLES = 1280;
    public static final int CONTEXT_SAMPLES = 480;   // 3 x 160-sample mel hops
    public static final int MEL_BINS = 32;
    public static final int EMBED_WINDOW = 76;       // mel frames per embedding
    public static final int EMBED_DIM = 96;
    public static final int CLASSIFIER_WINDOW = 16;  // embeddings per classification
    /** The classifier is meaningless until its buffers hold real audio. */
    public static final int WARMUP_FRAMES = 5;

    /** The three networks. Implementations may throw; the service reports it. */
    public interface Backend {
        /** @param samples int16-scaled floats; @return row-major [frames * 32]. */
        float[] melspectrogram(float[] samples, int length) throws Exception;

        /** @param melWindow row-major [76 * 32]; @return [96]. */
        float[] embed(float[] melWindow) throws Exception;

        /** @param features row-major [16 * 96]; @return score in [0, 1]. */
        float classify(float[] features) throws Exception;
    }

    private final Backend backend;

    private final float[] audioIn = new float[CONTEXT_SAMPLES + FRAME_SAMPLES];
    private final float[] melRing = new float[EMBED_WINDOW * MEL_BINS];
    private final float[] featRing = new float[CLASSIFIER_WINDOW * EMBED_DIM];
    private int framesSeen;

    private float threshold = 0.5f;
    private long cooldownMs = 2000;
    private long lastTriggerMs = Long.MIN_VALUE / 2;

    public OpenWakeWordEngine(Backend backend) {
        this.backend = backend;
        reset();
    }

    public void setThreshold(float threshold) {
        this.threshold = Math.max(0.05f, Math.min(0.99f, threshold));
    }

    public float getThreshold() {
        return threshold;
    }

    public void setCooldownMs(long cooldownMs) {
        this.cooldownMs = Math.max(0, cooldownMs);
    }

    /** Clears all audio history. Call after the mic was released for a while. */
    public void reset() {
        java.util.Arrays.fill(audioIn, 0f);
        java.util.Arrays.fill(melRing, 1f);   // openWakeWord seeds the mel buffer with ones
        java.util.Arrays.fill(featRing, 0f);
        framesSeen = 0;
    }

    /**
     * Maps the user-facing sensitivity slider (0 = strict, 1 = eager) onto a
     * score threshold. 0.7 (the app default) gives ~0.53.
     */
    public static float thresholdForSensitivity(float sensitivity) {
        float s = Math.max(0f, Math.min(1f, sensitivity));
        return 0.95f - 0.6f * s;
    }

    /**
     * Feeds exactly one 80 ms frame and returns the keyword score for it
     * (0 during warm-up).
     */
    public float process(short[] pcm) throws Exception {
        if (pcm == null || pcm.length != FRAME_SAMPLES) {
            throw new IllegalArgumentException("expected " + FRAME_SAMPLES + " samples");
        }

        // Slide: keep the last 480 samples of the previous input as left context.
        System.arraycopy(audioIn, FRAME_SAMPLES, audioIn, 0, CONTEXT_SAMPLES);
        for (int i = 0; i < FRAME_SAMPLES; i++) {
            audioIn[CONTEXT_SAMPLES + i] = pcm[i];
        }

        float[] mel = backend.melspectrogram(audioIn, audioIn.length);
        int newFrames = mel.length / MEL_BINS;
        if (newFrames <= 0) {
            throw new IllegalStateException("melspectrogram returned no frames");
        }
        if (newFrames > EMBED_WINDOW) {
            // Only the most recent window can matter.
            float[] tail = new float[EMBED_WINDOW * MEL_BINS];
            System.arraycopy(mel, (newFrames - EMBED_WINDOW) * MEL_BINS, tail, 0, tail.length);
            mel = tail;
            newFrames = EMBED_WINDOW;
        }

        int shift = newFrames * MEL_BINS;
        System.arraycopy(melRing, shift, melRing, 0, melRing.length - shift);
        for (int i = 0; i < shift; i++) {
            melRing[melRing.length - shift + i] = mel[i] / 10f + 2f;
        }

        float[] emb = backend.embed(melRing);
        if (emb.length != EMBED_DIM) {
            throw new IllegalStateException("embedding has " + emb.length + " dims, expected " + EMBED_DIM);
        }
        System.arraycopy(featRing, EMBED_DIM, featRing, 0, featRing.length - EMBED_DIM);
        System.arraycopy(emb, 0, featRing, featRing.length - EMBED_DIM, EMBED_DIM);

        float score = backend.classify(featRing);
        framesSeen++;
        return framesSeen <= WARMUP_FRAMES ? 0f : score;
    }

    /** True when {@code score} crosses the threshold outside the cooldown. */
    public boolean shouldTrigger(float score, long nowMs) {
        if (score < threshold) return false;
        if (nowMs - lastTriggerMs < cooldownMs) return false;
        lastTriggerMs = nowMs;
        return true;
    }
}
