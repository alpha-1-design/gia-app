package com.alpha1studio.gia;

import android.Manifest;
import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

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
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.getBooleanExtra("wakeWordDetected", false)) {
            String kw = intent.getStringExtra("wakeWordKeyword");
            fireWakeWordEvent(kw != null ? kw : "wake_word");
        }
    }

    @PluginMethod
    public void startListening(PluginCall call) {
        if (!hasPermission("record_audio")) {
            requestPermissionForAlias("record_audio", call, Manifest.permission.RECORD_AUDIO);
            return;
        }

        String accessKey = call.getString("accessKey", "");
        String keyword = call.getString("keyword", "JARVIS");
        double sensitivity = call.getDouble("sensitivity", 0.7);
        String customModelPath = call.getString("customModelPath", "");

        Intent serviceIntent = new Intent(getContext(), GIAWakeWordService.class);
        serviceIntent.putExtra("accessKey", accessKey);
        serviceIntent.putExtra("keyword", keyword);
        serviceIntent.putExtra("sensitivity", (float) sensitivity);
        serviceIntent.putExtra("customModelPath", customModelPath);

        getContext().startForegroundService(serviceIntent);
        call.resolve();
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        GIAWakeWordService.clearPluginRef();
        Intent serviceIntent = new Intent(getContext(), GIAWakeWordService.class);
        getContext().stopService(serviceIntent);
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

    public void onWakeWordDetected() {
        fireWakeWordEvent("wake_word");
    }

    public void notifyWakeWordError(String message) {
        JSObject error = new JSObject();
        error.put("error", message);
        notifyListeners("wakeWordError", error);
    }

    private void fireWakeWordEvent(String keyword) {
        JSObject ret = new JSObject();
        ret.put("keyword", keyword);
        notifyListeners("wakeWordDetected", ret);
    }
}
