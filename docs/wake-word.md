# On-device wake word (openWakeWord)

GIA listens for a wake phrase locally using [openWakeWord](https://github.com/dscripka/openWakeWord)
on ONNX Runtime. No account key, no network, no audio leaves the phone.

## Pipeline

16 kHz mono PCM in 80 ms frames (1280 samples), per frame:

1. `melspectrogram.onnx` on 480 samples of left context + the new frame -> 8 mel frames x 32 bins
2. `x / 10 + 2`, appended to a rolling 76-frame window
3. `embedding_model.onnx` on that window -> 96-dim embedding
4. last 16 embeddings -> `<keyword>.onnx` classifier -> score 0..1

Code: `OpenWakeWordEngine.java` (buffer logic, no Android imports), `OrtBackend.java`
(ONNX Runtime), `GIAWakeWordService.java` (mic loop + foreground service),
`GIAWakeWordPlugin.java` (Capacitor bridge), `src/services/GIAWakeWord.ts` (JS API).

## Sensitivity

The slider (0 strict .. 1 eager) maps to a score threshold: `0.95 - 0.6 * s`
(0.7 -> 0.53). Detections are rate-limited by a 2 s cooldown. The same formula lives in
`OpenWakeWordEngine.thresholdForSensitivity` and `src/utils/wakeWord.ts`; keep them equal.

## Microphone hand-off

After a detection the service releases the mic so SpeechRecognizer can use it. JS must call
`GIAWakeWord.resume()` when it is done (the service resumes by itself after 20 s as a safety net).

## Adding or training a phrase

Any `<name>.onnx` classifier placed in `android/app/src/main/assets/wakeword/` is discovered
automatically and appears in Settings -> Voice. A trailing `_v0.1` is stripped from the label.
Train one with the openWakeWord Colab/CLI (it needs only synthetic speech) for "Hey GIA".

## Training "Hey GIA" (planned)

Training needs a GPU notebook and several GB of data that this repo's CI cannot fetch, so it is
done once, off-device, and only the resulting `.onnx` file is committed:

1. Open the openWakeWord training notebook (Google Colab, free GPU).
2. Set the target phrase to `hey gia` (also train a couple of spellings people say: "hey gee-eye-ay").
3. Let it synthesise positive clips with many voices, add the negative/noise sets it downloads, train.
4. Download `hey_gia.onnx`, copy it to `android/app/src/main/assets/wakeword/hey_gia_v0.1.onnx`.
5. Rebuild. It appears in Settings > Voice automatically, and because you trained it, it carries
   no non-commercial licence from the bundled Hey Jarvis model.
6. Test false accepts for an hour of TV and conversation before shipping; raise the threshold if needed.

## Licensing - read before monetising

The shared feature models are Apache 2.0. The **pre-trained classifiers** (including
`hey_jarvis_v0.1.onnx`) are CC BY-NC-SA 4.0: non-commercial. Ship a classifier you trained
yourself before charging for GIA. See `assets/wakeword/README.md`.

## Known limits

- English phrases only (the upstream training uses English TTS).
- Android 12+ may refuse to start a microphone foreground service from the background; the
  service reports this through `wakeWordError`.
- A detection that cold-starts the app is delivered via `getPendingWakeWord()`; only the voice
  control hook polls it today.
- Not yet verified on a physical device: the Java engine matches the reference Python
  pipeline frame-for-frame on a synthetic "hey jarvis" clip, but real-world false accept/reject
  rates need on-device testing.
