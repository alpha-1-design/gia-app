package com.alpha1studio.gia;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge between the WebView brain and the persistent Android HUD overlay.
 *
 * The overlay itself is a foreground service so it can stay on screen while
 * the user is in another app. Input from the overlay is pushed back into JS as
 * `hudMessage`; JS streams the answer back with `streamDelta`.
 */
@CapacitorPlugin(name = "GIAHud")
public class GIAHudPlugin extends Plugin {

    private static GIAHudPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        if (instance == this) instance = null;
    }

    private boolean ensureOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
            && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
            } catch (Exception ignored) {
                // The caller still gets a useful error below.
            }
            call.reject("Overlay permission required", "OVERLAY_PERMISSION");
            return false;
        }
        return true;
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (!ensureOverlayPermission(call)) return;
        GIAHudService.start(getContext());
        call.resolve();
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (!ensureOverlayPermission(call)) return;
        GIAHudService.show(getContext());

        // The service starts asynchronously. Wait for the overlay view to be
        // attached before resolving, otherwise the first history sync is lost.
        final Handler handler = new Handler(Looper.getMainLooper());
        final long deadline = System.currentTimeMillis() + 2000L;
        handler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (GIAHudService.isVisible()) {
                    call.resolve();
                } else if (System.currentTimeMillis() >= deadline) {
                    call.reject("The floating HUD did not start", "HUD_START_FAILED");
                } else {
                    handler.postDelayed(this, 50L);
                }
            }
        }, 50L);
    }

    @PluginMethod
    public void hide(PluginCall call) {
        GIAHudService.hide(getContext());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        GIAHudService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void isVisible(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("visible", GIAHudService.isVisible());
        call.resolve(ret);
    }

    @PluginMethod
    public void appendMessage(PluginCall call) {
        String role = call.getString("role", "assistant");
        String text = call.getString("text", "");
        GIAHudService.appendMessage(role, text);
        call.resolve();
    }

    @PluginMethod
    public void streamDelta(PluginCall call) {
        String delta = call.getString("delta", "");
        boolean done = Boolean.TRUE.equals(call.getBoolean("done", false));
        String finalText = call.getString("finalText", null);
        GIAHudService.streamDelta(delta, done, finalText);
        call.resolve();
    }

    @PluginMethod
    public void setBusy(PluginCall call) {
        boolean busy = Boolean.TRUE.equals(call.getBoolean("busy", false));
        GIAHudService.setBusy(busy);
        call.resolve();
    }

    @PluginMethod
    public void clearMessages(PluginCall call) {
        GIAHudService.clearMessages();
        call.resolve();
    }

    static boolean isConnected() {
        return instance != null;
    }

    /** Called when the overlay's power button turns the HUD off. */
    static void notifyClosed() {
        final GIAHudPlugin plugin = instance;
        if (plugin == null) return;
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                plugin.notifyListeners("hudClosed", new JSObject());
            } catch (Exception ignored) {
                // App is gone; nothing to sync.
            }
        });
    }

    /** Called by the overlay's send button. */
    static void dispatchFromHud(final String text) {
        final GIAHudPlugin plugin = instance;
        if (plugin == null || text == null || text.trim().isEmpty()) return;
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                JSObject data = new JSObject();
                data.put("text", text);
                plugin.notifyListeners("hudMessage", data);
            } catch (Exception ignored) {
                // The WebView may be gone; the overlay will show a local error.
                GIAHudService.appendMessage("assistant", "GIA is not connected. Open the app and try again.");
                GIAHudService.setBusy(false);
            }
        });
    }
}
