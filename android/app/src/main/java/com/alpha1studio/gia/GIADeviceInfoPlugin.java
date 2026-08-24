package com.alpha1studio.gia;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * GIADeviceInfo — real device capability detection for local-model
 * compatibility checks.
 *
 * The WebView can't see total physical RAM or real free storage on
 * Android: navigator.deviceMemory is Chrome-only and commonly absent in
 * Capacitor WebViews, so the previous "detection" silently fell back to a
 * hardcoded 4 GB guess. This plugin reads the actual numbers from native
 * APIs (ActivityManager.MemoryInfo, StatFs, Runtime, Build) so the
 * model-compatibility verdict is grounded in the real device.
 */
@CapacitorPlugin(name = "GIADeviceInfo")
public class GIADeviceInfoPlugin extends Plugin {

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject obj = new JSObject();
        Context ctx = getContext();

        // ── RAM (real, from ActivityManager) ────────────────────────
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        if (am != null) {
            ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            obj.put("totalRAM", mi.totalMem);
            obj.put("availableRAM", mi.availMem);
            obj.put("lowMemory", mi.lowMemory);
            obj.put("threshold", mi.threshold);
            obj.put("isLowRamDevice", am.isLowRamDevice());
        } else {
            obj.put("totalRAM", 0L);
            obj.put("availableRAM", 0L);
            obj.put("lowMemory", false);
            obj.put("threshold", 0L);
            obj.put("isLowRamDevice", false);
        }

        // ── Storage (real, from StatFs on the app data dir) ─────────
        File dataDir = ctx.getFilesDir();
        try {
            StatFs stat = new StatFs(dataDir.getAbsolutePath());
            long blockSize = stat.getBlockSizeLong();
            obj.put("storageTotal", stat.getBlockCountLong() * blockSize);
            obj.put("storageFree", stat.getAvailableBlocksLong() * blockSize);
        } catch (Exception e) {
            obj.put("storageTotal", 0L);
            obj.put("storageFree", 0L);
        }

        // External storage (SD / shared) as a bonus figure.
        try {
            File ext = ctx.getExternalFilesDir(null);
            if (ext != null) {
                StatFs stat = new StatFs(ext.getAbsolutePath());
                long blockSize = stat.getBlockSizeLong();
                obj.put("externalStorageFree", stat.getAvailableBlocksLong() * blockSize);
            } else {
                obj.put("externalStorageFree", 0L);
            }
        } catch (Exception e) {
            obj.put("externalStorageFree", 0L);
        }

        // ── CPU / device identity ───────────────────────────────────
        obj.put("cpuCores", Runtime.getRuntime().availableProcessors());
        obj.put("model", Build.MODEL);
        obj.put("manufacturer", Build.MANUFACTURER);
        obj.put("device", Build.DEVICE);
        obj.put("androidVersion", Build.VERSION.RELEASE);
        obj.put("apiLevel", Build.VERSION.SDK_INT);

        call.resolve(obj);
    }
}
