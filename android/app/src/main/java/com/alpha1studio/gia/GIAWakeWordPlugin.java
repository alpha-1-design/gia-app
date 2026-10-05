package com.alpha1studio.gia;

import android.Manifest;
import android.content.Intent;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

/**
 * JS bridge for the on-device openWakeWord service ({@link GIAWakeWordService}).
 *
 * Events: wakeWordDetected {keyword, score}, wakeWordScore {score} (only while
 * startListening was called with emitScores), wakeWordError {error}.
 */
@CapacitorPlugin(
    name = "GIAWakeWord",
    permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, alias = "record_audio")
    }
)
public class GIAWakeWordPlugin extends Plugin {

    @Override
    public void load() {
        super.load();
        GIAWakeWordService.setPluginRef(this);
        GIAWakeWordService.setAppInForeground(true);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        GIAWakeWordService.setAppInForeground(true);
    }

    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        GIAWakeWordService.setAppInForeground(false);
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.getBooleanExtra("wakeWordDetected", false)) {
            String kw = intent.getStringExtra("wakeWordKeyword");
            float score = intent.getFloatExtra("wakeWordScore", 0f);
            intent.removeExtra("wakeWordDetected");   // never replay on a later onNewIntent
            GIAWakeWordService.getPendingKeyword();    // delivered here; clear the pending copy
            onWakeWordDetected(kw != null ? kw : "wake_word", score);
        }
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState("record_audio") != PermissionState.GRANTED) {
            requestPermissionForAlias("record_audio", call, "micPermissionCallback");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void micPermissionCallback(PluginCall call) {
        if (getPermissionState("record_audio") == PermissionState.GRANTED) {
            doStart(call);
        } else {
            call.reject("Microphone permission denied");
        }
    }

    private void doStart(PluginCall call) {
        // Primitives on purpose: putExtra(String, Float) resolves to the Serializable
        // overload, which getFloatExtra() then silently ignores.
        String keyword = call.getString("keyword", "");
        String customModelPath = call.getString("customModelPath", "");
        float sensitivity = call.getFloat("sensitivity", 0.7f);
        boolean emitScores = Boolean.TRUE.equals(call.getBoolean("emitScores", false));

        Intent serviceIntent = new Intent(getContext(), GIAWakeWordService.class);
        serviceIntent.putExtra("keyword", keyword);
        serviceIntent.putExtra("sensitivity", sensitivity);
        serviceIntent.putExtra("customModelPath", customModelPath);
        serviceIntent.putExtra("emitScores", emitScores);
        try {
            getContext().startForegroundService(serviceIntent);
        } catch (Exception e) {
            call.reject("Could not start wake word service: " + e.getMessage());
            return;
        }
        call.resolve();
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        GIAWakeWordService.markDisabled(getContext());
        getContext().stopService(new Intent(getContext(), GIAWakeWordService.class));
        call.resolve();
    }

    /** Release the microphone so SpeechRecognizer can use it. Auto-resumes after 20 s. */
    @PluginMethod
    public void pause(PluginCall call) {
        GIAWakeWordService.pauseCapture();
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        GIAWakeWordService.resumeCapture();
        call.resolve();
    }

    @PluginMethod
    public void getPendingWakeWord(PluginCall call) {
        String keyword = GIAWakeWordService.getPendingKeyword();
        boolean detected = keyword != null && !keyword.isEmpty();
        JSObject ret = new JSObject();
        ret.put("detected", detected);
        ret.put("keyword", detected ? keyword : "");
        call.resolve(ret);
    }

    @PluginMethod
    public void isListening(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("listening", GIAWakeWordService.isRunning());
        call.resolve(ret);
    }

    @PluginMethod
    public void listKeywords(PluginCall call) {
        List<String> ids = GIAWakeWordService.listKeywords(getContext());
        JSArray keywords = new JSArray();
        for (String id : ids) {
            JSObject k = new JSObject();
            k.put("id", id);
            k.put("label", GIAWakeWordService.displayLabel(id));
            keywords.put(k);
        }
        JSObject ret = new JSObject();
        ret.put("keywords", keywords);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", GIAWakeWordService.isRunning());
        ret.put("paused", GIAWakeWordService.isPaused());
        ret.put("keyword", GIAWakeWordService.getActiveLabel());
        ret.put("threshold", GIAWakeWordService.getActiveThreshold());
        ret.put("lastScore", GIAWakeWordService.getLastScore());
        ret.put("error", GIAWakeWordService.getLastError());
        ret.put("micPermission", getPermissionState("record_audio") == PermissionState.GRANTED);
        call.resolve(ret);
    }

    public void onWakeWordDetected(String keyword, float score) {
        JSObject ret = new JSObject();
        ret.put("keyword", keyword);
        ret.put("score", score);
        notifyListeners("wakeWordDetected", ret, true);
    }

    public void notifyWakeWordScore(float score) {
        JSObject ret = new JSObject();
        ret.put("score", score);
        notifyListeners("wakeWordScore", ret);
    }

    public void notifyWakeWordError(String message) {
        JSObject error = new JSObject();
        error.put("error", message);
        notifyListeners("wakeWordError", error, true);
    }
}
