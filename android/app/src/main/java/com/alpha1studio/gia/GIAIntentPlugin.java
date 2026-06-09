package com.alpha1studio.gia;

import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "GIAIntent")
public class GIAIntentPlugin extends Plugin {

    private static final String EVENT_ASSIST = "onAssist";
    private static final String EVENT_DEEP_LINK = "onDeepLink";
    private static final String EVENT_SHARE = "onShareReceived";

    @Override
    public void load() {
        super.load();
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent == null) return;

        String action = intent.getAction();
        if (action == null) return;

        switch (action) {
            case Intent.ACTION_ASSIST:
                handleAssistIntent(intent);
                break;
            case Intent.ACTION_SEND:
                handleSendIntent(intent);
                break;
            case Intent.ACTION_SEND_MULTIPLE:
                handleSendMultipleIntent(intent);
                break;
            case Intent.ACTION_VIEW:
                handleViewIntent(intent);
                break;
        }
    }

    private void handleAssistIntent(Intent intent) {
        JSObject ret = new JSObject();
        String source = intent.getStringExtra("source");
        ret.put("source", source != null ? source : "assist");
        ret.put("type", "assist");
        notifyListeners(EVENT_ASSIST, ret);
    }

    private void handleSendIntent(Intent intent) {
        String type = intent.getType();
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);

        JSObject ret = new JSObject();
        ret.put("type", "share");
        ret.put("mimeType", type != null ? type : "");

        if (text != null) {
            ret.put("text", text);
        }
        if (subject != null) {
            ret.put("subject", subject);
        }
        if (imageUri != null) {
            ret.put("imageUri", imageUri.toString());
        }

        notifyListeners(EVENT_SHARE, ret);
    }

    private void handleSendMultipleIntent(Intent intent) {
        // For multiple files/images
        notifyListeners(EVENT_SHARE, new JSObject());
    }

    private void handleViewIntent(Intent intent) {
        Uri data = intent.getData();
        if (data == null) return;

        JSObject ret = new JSObject();
        ret.put("type", "deep_link");
        ret.put("uri", data.toString());
        ret.put("scheme", data.getScheme() != null ? data.getScheme() : "");
        ret.put("host", data.getHost() != null ? data.getHost() : "");
        ret.put("path", data.getPath() != null ? data.getPath() : "");
        ret.put("query", data.getQuery() != null ? data.getQuery() : "");

        notifyListeners(EVENT_DEEP_LINK, ret);
    }

    @PluginMethod
    public void getPendingIntent(PluginCall call) {
        // Return the intent that launched the app, if any
        Intent intent = getActivity().getIntent();
        if (intent != null && intent.getAction() != null) {
            JSObject ret = new JSObject();
            ret.put("action", intent.getAction());
            ret.put("hasData", intent.getData() != null);

            if (Intent.ACTION_SEND.equals(intent.getAction())) {
                ret.put("text", intent.getStringExtra(Intent.EXTRA_TEXT));
                ret.put("mimeType", intent.getType());
            }
            if (intent.getData() != null) {
                ret.put("uri", intent.getData().toString());
            }

            call.resolve(ret);
        } else {
            call.resolve(new JSObject());
        }
    }

    @PluginMethod
    public void clearIntent(PluginCall call) {
        getActivity().setIntent(new Intent());
        call.resolve();
    }
}
