package com.alpha1studio.gia;

import java.nio.FloatBuffer;
import java.util.Collections;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;

/**
 * ONNX Runtime implementation of {@link OpenWakeWordEngine.Backend}.
 *
 * Tensor layouts (verified against the openWakeWord v0.5.1 models):
 *   melspectrogram.onnx  in [1, samples]        out [frames, 1, 1, 32]
 *   embedding_model.onnx in [1, 76, 32, 1]      out [1, 1, 1, 96]
 *   <keyword>.onnx       in [1, 16, 96]         out [1, 1]
 *
 * Every session runs single-threaded: the networks are tiny and a
 * always-on listener should not wake several cores per 80 ms frame.
 */
final class OrtBackend implements OpenWakeWordEngine.Backend, AutoCloseable {

    private final OrtEnvironment env = OrtEnvironment.getEnvironment();
    private final OrtSession melSession;
    private final OrtSession embSession;
    private final OrtSession clfSession;
    private final String melInput;
    private final String embInput;
    private final String clfInput;

    OrtBackend(byte[] melModel, byte[] embeddingModel, byte[] classifierModel) throws OrtException {
        OrtSession mel = null;
        OrtSession emb = null;
        OrtSession clf = null;
        try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
            options.setIntraOpNumThreads(1);
            options.setInterOpNumThreads(1);
            options.setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT);
            mel = env.createSession(melModel, options);
            emb = env.createSession(embeddingModel, options);
            clf = env.createSession(classifierModel, options);
        } catch (OrtException | RuntimeException e) {
            closeQuietly(mel);
            closeQuietly(emb);
            closeQuietly(clf);
            throw e;
        }
        melSession = mel;
        embSession = emb;
        clfSession = clf;
        melInput = melSession.getInputNames().iterator().next();
        embInput = embSession.getInputNames().iterator().next();
        clfInput = clfSession.getInputNames().iterator().next();
    }

    @Override
    public float[] melspectrogram(float[] samples, int length) throws OrtException {
        return run(melSession, melInput, samples, new long[] {1, length});
    }

    @Override
    public float[] embed(float[] melWindow) throws OrtException {
        return run(embSession, embInput, melWindow,
                new long[] {1, OpenWakeWordEngine.EMBED_WINDOW, OpenWakeWordEngine.MEL_BINS, 1});
    }

    @Override
    public float classify(float[] features) throws OrtException {
        float[] out = run(clfSession, clfInput, features,
                new long[] {1, OpenWakeWordEngine.CLASSIFIER_WINDOW, OpenWakeWordEngine.EMBED_DIM});
        return out[0];
    }

    private float[] run(OrtSession session, String inputName, float[] data, long[] shape) throws OrtException {
        try (OnnxTensor input = OnnxTensor.createTensor(env, FloatBuffer.wrap(data), shape);
             OrtSession.Result result = session.run(Collections.singletonMap(inputName, input))) {
            FloatBuffer buf = ((OnnxTensor) result.get(0)).getFloatBuffer();
            float[] out = new float[buf.remaining()];
            buf.get(out);
            return out;
        }
    }

    @Override
    public void close() {
        closeQuietly(melSession);
        closeQuietly(embSession);
        closeQuietly(clfSession);
    }

    private static void closeQuietly(OrtSession s) {
        if (s == null) return;
        try {
            s.close();
        } catch (OrtException ignored) {
            // nothing useful to do while tearing down
        }
    }
}
