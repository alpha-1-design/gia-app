package com.alpha1studio.gia;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "GIAOverlay",
    permissions = {
        @Permission(strings = {Manifest.permission.SYSTEM_ALERT_WINDOW}, alias = "overlay")
    }
)
public class GIAOverlayPlugin extends Plugin {

    private static final int REQUEST_MEDIA_PROJECTION = 9001;
    private PluginCall pendingCall;

    @Override
    public void load() {
        super.load();
    }

    @PluginMethod
    public void startOverlay(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(getContext())) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                android.net.Uri.parse("package:" + getContext().getPackageName())
            );
            getActivity().startActivity(intent);
            call.reject("SYSTEM_ALERT_WINDOW permission required");
            return;
        }

        pendingCall = call;

        MediaProjectionManager mpm = (MediaProjectionManager) getContext()
            .getSystemService(android.content.Context.MEDIA_PROJECTION_SERVICE);

        if (mpm == null) {
            call.reject("MediaProjection not available");
            pendingCall = null;
            return;
        }

        Intent consentIntent = mpm.createScreenCaptureIntent();
        getActivity().startActivityForResult(consentIntent, REQUEST_MEDIA_PROJECTION);
    }

    @PluginMethod
    public void hideOverlay(PluginCall call) {
        GIAOverlayService.hideOverlay();
        call.resolve();
    }

    @PluginMethod
    public void isOverlayVisible(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("visible", GIAOverlayService.isOverlayVisible());
        call.resolve(ret);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);

        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                int resultCodeCopy = resultCode;
                Intent dataCopy = data;
                if (pendingCall != null) {
                    pendingCall.resolve();
                    pendingCall = null;
                }
                GIAOverlayService.startOverlay(getContext(), resultCodeCopy, dataCopy, this);
            } else {
                if (pendingCall != null) {
                    pendingCall.reject("Screen capture permission denied");
                    pendingCall = null;
                }
            }
        }
    }

    public void onRegionCaptured(String dataUrl, String query) {
        JSObject ret = new JSObject();
        ret.put("dataUrl", dataUrl);
        if (query != null && !query.isEmpty()) {
            ret.put("text", query);
        }
        notifyListeners("overlayResult", ret);
    }

    public void onQuerySubmitted(String query) {
        JSObject ret = new JSObject();
        ret.put("text", query);
        notifyListeners("overlayResult", ret);
    }

    public void onOverlayCancelled() {
        JSObject ret = new JSObject();
        ret.put("cancelled", true);
        notifyListeners("overlayResult", ret);
    }
}
