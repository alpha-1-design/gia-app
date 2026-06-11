package com.alpha1studio.gia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.ConnectivityManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor bridge for GIACoreService — exposes background service
 * status, network state, and autonomy config to the WebView.
 */
@CapacitorPlugin(name = "GIA Core")
public class CorePlugin extends Plugin {

    private GIACoreService coreService;
    private NetworkBroadcastReceiver networkReceiver;

    @Override
    public void load() {
        super.load();
        networkReceiver = new NetworkBroadcastReceiver();
        IntentFilter filter = new IntentFilter("com.alpha1studio.gia.NETWORK_CHANGED");
        getContext().registerReceiver(networkReceiver, filter, Context.RECEIVER_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            getContext().unregisterReceiver(networkReceiver);
        } catch (Exception ignored) {}
    }

    /**
     * Start the GIACoreService with optional wake word params.
     * If startWakeWord is true, passes along accessKey/keyword/sensitivity.
     */
    @PluginMethod
    public void startCoreService(PluginCall call) {
        Intent intent = new Intent(getContext(), GIACoreService.class);
        intent.putExtra("startWakeWord", call.getBoolean("startWakeWord", false));
        intent.putExtra("accessKey", call.getString("accessKey", ""));
        intent.putExtra("keyword", call.getString("keyword", "JARVIS"));
        intent.putExtra("sensitivity", (float) call.getDouble("sensitivity", 0.7));
        intent.putExtra("customModelPath", call.getString("customModelPath", ""));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopCoreService(PluginCall call) {
        Intent intent = new Intent(getContext(), GIACoreService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        GIACoreService svc = GIACoreService.getInstance();
        JSObject obj = new JSObject();
        if (svc != null) {
            obj.put("running", GIACoreService.isRunning());
            obj.put("online", svc.isOnline());
            obj.put("networkType", svc.getNetworkType());
            obj.put("metered", svc.isMetered());
            obj.put("wakeLockHeld", svc.isWakeLockHeld());
        } else {
            obj.put("running", false);
            obj.put("online", false);
            obj.put("networkType", "none");
            obj.put("metered", false);
            obj.put("wakeLockHeld", false);
        }
        call.resolve(obj);
    }

    @PluginMethod
    public void getNetworkState(PluginCall call) {
        GIACoreService svc = GIACoreService.getInstance();
        JSObject obj = new JSObject();
        if (svc != null) {
            obj.put("online", svc.isOnline());
            obj.put("type", svc.getNetworkType());
            obj.put("metered", svc.isMetered());
        } else {
            obj.put("online", false);
            obj.put("type", "none");
            obj.put("metered", false);
        }
        call.resolve(obj);
    }

    @PluginMethod
    public void requestBatteryOptimizationExemption(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
        intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
        getContext().startActivity(intent);
        call.resolve();
    }

    /**
     * Forward to JS: network changed. The TS side listens via
     * CorePlugin.addListener('networkChanged', ...)
     */
    private void notifyNetworkChanged() {
        GIACoreService svc = GIACoreService.getInstance();
        if (svc == null) return;
        JSObject obj = new JSObject();
        obj.put("online", svc.isOnline());
        obj.put("type", svc.getNetworkType());
        obj.put("metered", svc.isMetered());
        notifyListeners("networkChanged", obj);
    }

    /**
     * Internal receiver that forwards NetworkChanged broadcasts from
     * GIACoreService to JS listeners.
     */
    private class NetworkBroadcastReceiver extends BroadcastReceiver {
        @Override
        public void onReceive(Context context, Intent intent) {
            if ("com.alpha1studio.gia.NETWORK_CHANGED".equals(intent.getAction())) {
                notifyNetworkChanged();
            }
        }
    }
}
