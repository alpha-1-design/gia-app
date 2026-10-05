package com.alpha1studio.gia;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** Buffer arithmetic of the openWakeWord pipeline, with the networks stubbed out. */
public class OpenWakeWordEngineTest {

    /** Records what the engine feeds each network and replays a scripted score. */
    private static final class StubBackend implements OpenWakeWordEngine.Backend {
        int melCalls, embedCalls, classifyCalls;
        int lastMelLength;
        float[] lastMelInput;
        float[] lastEmbedInput;
        float[] lastClassifyInput;
        float score = 0f;
        int melFramesPerCall = 8;
        float melValue = 0f;
        float embedValue = 1f;

        @Override
        public float[] melspectrogram(float[] samples, int length) {
            melCalls++;
            lastMelLength = length;
            lastMelInput = samples.clone();
            float[] out = new float[melFramesPerCall * OpenWakeWordEngine.MEL_BINS];
            java.util.Arrays.fill(out, melValue);
            return out;
        }

        @Override
        public float[] embed(float[] melWindow) {
            embedCalls++;
            lastEmbedInput = melWindow.clone();
            float[] out = new float[OpenWakeWordEngine.EMBED_DIM];
            java.util.Arrays.fill(out, embedValue);
            return out;
        }

        @Override
        public float classify(float[] features) {
            classifyCalls++;
            lastClassifyInput = features.clone();
            return score;
        }
    }

    private static short[] frameOf(short v) {
        short[] f = new short[OpenWakeWordEngine.FRAME_SAMPLES];
        java.util.Arrays.fill(f, v);
        return f;
    }

    @Test
    public void melInputIsContextPlusFrame() throws Exception {
        StubBackend b = new StubBackend();
        OpenWakeWordEngine e = new OpenWakeWordEngine(b);
        e.process(frameOf((short) 100));
        e.process(frameOf((short) 200));

        assertEquals(OpenWakeWordEngine.CONTEXT_SAMPLES + OpenWakeWordEngine.FRAME_SAMPLES, b.lastMelLength);
        // First 480 samples are the tail of the previous frame, the rest are new.
        assertEquals(100f, b.lastMelInput[0], 0f);
        assertEquals(100f, b.lastMelInput[OpenWakeWordEngine.CONTEXT_SAMPLES - 1], 0f);
        assertEquals(200f, b.lastMelInput[OpenWakeWordEngine.CONTEXT_SAMPLES], 0f);
    }

    @Test
    public void melOutputIsNormalisedIntoTheRollingWindow() throws Exception {
        StubBackend b = new StubBackend();
        b.melValue = 10f;   // 10 / 10 + 2 = 3
        OpenWakeWordEngine e = new OpenWakeWordEngine(b);
        e.process(frameOf((short) 0));

        float[] w = b.lastEmbedInput;
        assertEquals(OpenWakeWordEngine.EMBED_WINDOW * OpenWakeWordEngine.MEL_BINS, w.length);
        assertEquals(3f, w[w.length - 1], 1e-6f);                          // newest frames
        assertEquals(1f, w[0], 1e-6f);                                      // still the seed of ones
    }

    @Test
    public void classifierSeesTheLatestEmbeddingLast() throws Exception {
        StubBackend b = new StubBackend();
        OpenWakeWordEngine e = new OpenWakeWordEngine(b);
        b.embedValue = 5f;
        e.process(frameOf((short) 0));
        float[] f = b.lastClassifyInput;
        assertEquals(OpenWakeWordEngine.CLASSIFIER_WINDOW * OpenWakeWordEngine.EMBED_DIM, f.length);
        assertEquals(5f, f[f.length - 1], 0f);
        assertEquals(0f, f[0], 0f);
    }

    @Test
    public void scoresAreSuppressedDuringWarmup() throws Exception {
        StubBackend b = new StubBackend();
        b.score = 0.99f;
        OpenWakeWordEngine e = new OpenWakeWordEngine(b);
        for (int i = 0; i < OpenWakeWordEngine.WARMUP_FRAMES; i++) {
            assertEquals(0f, e.process(frameOf((short) 0)), 0f);
        }
        assertEquals(0.99f, e.process(frameOf((short) 0)), 1e-6f);
    }

    @Test
    public void resetRestartsWarmup() throws Exception {
        StubBackend b = new StubBackend();
        b.score = 0.99f;
        OpenWakeWordEngine e = new OpenWakeWordEngine(b);
        for (int i = 0; i < 10; i++) e.process(frameOf((short) 0));
        e.reset();
        assertEquals(0f, e.process(frameOf((short) 0)), 0f);
    }

    @Test
    public void oversizedMelOutputIsTrimmedToTheWindow() throws Exception {
        StubBackend b = new StubBackend();
        b.melFramesPerCall = 100;
        OpenWakeWordEngine e = new OpenWakeWordEngine(b);
        e.process(frameOf((short) 0));
        assertEquals(OpenWakeWordEngine.EMBED_WINDOW * OpenWakeWordEngine.MEL_BINS, b.lastEmbedInput.length);
    }

    @Test(expected = IllegalArgumentException.class)
    public void wrongFrameSizeIsRejected() throws Exception {
        new OpenWakeWordEngine(new StubBackend()).process(new short[100]);
    }

    @Test
    public void triggerRespectsThresholdAndCooldown() {
        OpenWakeWordEngine e = new OpenWakeWordEngine(new StubBackend());
        e.setThreshold(0.5f);
        e.setCooldownMs(2000);
        assertFalse(e.shouldTrigger(0.49f, 10_000));
        assertTrue(e.shouldTrigger(0.9f, 10_000));
        assertFalse(e.shouldTrigger(0.9f, 11_000));   // inside cooldown
        assertTrue(e.shouldTrigger(0.9f, 12_001));
    }

    @Test
    public void sensitivityMapsToAThresholdRange() {
        assertEquals(0.53f, OpenWakeWordEngine.thresholdForSensitivity(0.7f), 1e-6f);
        assertTrue(OpenWakeWordEngine.thresholdForSensitivity(1f) < OpenWakeWordEngine.thresholdForSensitivity(0f));
        // out-of-range input is clamped, not extrapolated
        assertEquals(OpenWakeWordEngine.thresholdForSensitivity(1f), OpenWakeWordEngine.thresholdForSensitivity(5f), 0f);
    }
}
