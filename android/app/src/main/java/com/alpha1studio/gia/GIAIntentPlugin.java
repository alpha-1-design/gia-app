package com.alpha1studio.gia;

import android.content.Intent;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import org.json.JSONArray;
import org.json.JSONObject;
import android.app.PendingIntent;
import android.os.Bundle;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@CapacitorPlugin(name = "GIAIntent")
public class GIAIntentPlugin extends Plugin {
    private static GIAIntentPlugin instance;
    private final ConcurrentHashMap<String, PluginCall> termuxCalls = new ConcurrentHashMap<>();
    // Timeout runnables keyed by jobId so a late Termux result can cancel its
    // own watchdog instead of leaking both the call and the scheduled task.
    private final ConcurrentHashMap<String, Runnable> termuxTimeouts = new ConcurrentHashMap<>();
    private final Handler termuxHandler = new Handler(Looper.getMainLooper());

    /** How long to wait for Termux before rejecting. */
    private static final long TERMUX_TIMEOUT_MS = 30000L;
    /** Readiness probe budget — short, because it only proves the bridge works. */
    private static final long TERMUX_PROBE_TIMEOUT_MS = 4000L;

    /** Job id prefix used to tell a readiness probe from a real command. */
    private static final String PROBE_PREFIX = "probe-";

    private static final String ALLOW_EXTERNAL_APPS_HINT =
            "Termux did not respond to GIA. Open Termux and add "
            + "`allow-external-apps = true` to ~/.termux/termux.properties, then restart Termux.";

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    @Override
    protected void handleOnDestroy() {
        // Reject anything still parked so JS promises never outlive the plugin.
        for (String jobId : new ArrayList<>(termuxCalls.keySet())) {
            failTermuxCall(jobId, "Termux integration was shut down before the command finished");
        }
        super.handleOnDestroy();
    }

    private void scheduleTermuxTimeout(final String jobId, long delayMs, final String message) {
        Runnable task = new Runnable() {
            @Override
            public void run() {
                termuxTimeouts.remove(jobId);
                failTermuxCall(jobId, message);
            }
        };
        termuxTimeouts.put(jobId, task);
        termuxHandler.postDelayed(task, delayMs);
    }

    private void cancelTermuxTimeout(String jobId) {
        Runnable task = termuxTimeouts.remove(jobId);
        if (task != null) termuxHandler.removeCallbacks(task);
    }

    /** Reject and remove a parked call. Safe to call more than once. */
    private void failTermuxCall(String jobId, String message) {
        cancelTermuxTimeout(jobId);
        PluginCall call = termuxCalls.remove(jobId);
        if (call == null) return;
        call.reject(message);
    }

    public static void deliverTermuxResult(String jobId, Bundle result) {
        GIAIntentPlugin plugin = instance;
        if (plugin == null) return;
        plugin.cancelTermuxTimeout(jobId);
        PluginCall call = plugin.termuxCalls.remove(jobId);
        if (call == null) return;
        // Readiness probes answer with the status shape, not a command result.
        if (jobId.startsWith(PROBE_PREFIX)) {
            call.resolve(plugin.buildStatusPayload(true, Boolean.TRUE, "probe_ok"));
            return;
        }
        JSObject response = new JSObject();
        response.put("jobId", jobId);
        response.put("stdout", result.getString("com.termux.RUN_COMMAND_RESULT_STDOUT", ""));
        response.put("stderr", result.getString("com.termux.RUN_COMMAND_RESULT_STDERR", ""));
        response.put("exitCode", result.getInt("com.termux.RUN_COMMAND_RESULT_EXITCODE", 0));
        call.resolve(response);
    }

    private static final String EVENT_ASSIST = "onAssist";
    private static final String EVENT_DEEP_LINK = "onDeepLink";
    private static final String EVENT_SHARE = "onShareReceived";
    private static final String EVENT_WIDGET_ACTION = "onWidgetAction";

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
            case Intent.ACTION_MAIN:
                handleWidgetAction(intent);
                break;
        }
    }

    // Home screen widget buttons launch with ACTION_MAIN (same as tapping the
    // launcher icon) plus a custom "action" extra. Only fire if that extra is
    // actually present, so a normal resume-from-recents doesn't trigger this.
    private void handleWidgetAction(Intent intent) {
        String widgetAction = intent.getStringExtra("action");
        if (widgetAction == null || widgetAction.isEmpty()) return;

        JSObject ret = new JSObject();
        ret.put("action", widgetAction);
        notifyListeners(EVENT_WIDGET_ACTION, ret);
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
        String type = intent.getType();
        ArrayList<Uri> uris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);

        JSObject ret = new JSObject();
        ret.put("type", "share");
        ret.put("mimeType", type != null ? type : "");
        ret.put("multiple", true);

        if (uris != null && !uris.isEmpty()) {
            ret.put("imageUri", uris.get(0).toString());
            String[] uriArr = new String[uris.size()];
            for (int i = 0; i < uris.size(); i++) {
                uriArr[i] = uris.get(i).toString();
            }
            ret.put("uris", uriArr);
        }

        notifyListeners(EVENT_SHARE, ret);
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

            String widgetAction = intent.getStringExtra("action");
            if (widgetAction != null && !widgetAction.isEmpty()) {
                ret.put("widgetAction", widgetAction);
            }

            if (Intent.ACTION_SEND.equals(intent.getAction())) {
                ret.put("text", intent.getStringExtra(Intent.EXTRA_TEXT));
                ret.put("subject", intent.getStringExtra(Intent.EXTRA_SUBJECT));
                ret.put("mimeType", intent.getType());
                Uri streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (streamUri != null) {
                    ret.put("imageUri", streamUri.toString());
                }
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

    /**
     * Reads Termux's termux.properties to see whether it accepts commands from
     * other apps. GIA usually cannot read Termux's private data dir (separate
     * UID), so an unknown answer is normal and means "probe required".
     *
     * @return true / false, or null when the file is unreadable.
     */
    private Boolean readAllowExternalApps() {
        File props = new File("/data/data/com.termux/files/home/.termux/termux.properties");
        if (!props.isFile()) return null;
        try (BufferedReader reader = new BufferedReader(new FileReader(props))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.startsWith("#") || trimmed.startsWith("!")) continue;
                int eq = trimmed.indexOf('=');
                if (eq < 0) continue;
                String key = trimmed.substring(0, eq).trim();
                if (!"allow-external-apps".equals(key)) continue;
                String value = trimmed.substring(eq + 1).trim();
                return "true".equalsIgnoreCase(value);
            }
        } catch (Exception ignored) {
            // Different UID, SELinux, or no such file — fall through to probe.
        }
        return null;
    }

    @PluginMethod
    public void termuxStatus(PluginCall call) {
        boolean installed;
        try {
            getContext().getPackageManager().getPackageInfo("com.termux", 0);
            installed = true;
        } catch (Exception e) {
            installed = false;
        }

        if (!installed) {
            JSObject missing = new JSObject();
            missing.put("installed", false);
            missing.put("ready", false);
            missing.put("allowExternalApps", false);
            missing.put("bridgeResponsive", false);
            missing.put("reason", "not_installed");
            missing.put("hint", "Install Termux to let GIA run approved commands there.");
            call.resolve(missing);
            return;
        }

        final Boolean declared = readAllowExternalApps();
        final String probeJobId = "probe-" + UUID.randomUUID();

        // The honest check: a real round trip. A package being installed says
        // nothing about whether Termux will service RUN_COMMAND, so we send a
        // trivial command and see whether the result comes back. The probe call
        // is parked in termuxCalls like any other and resolves via
        // TermuxResultReceiver; if nothing arrives, the watchdog fires.
        Intent probe = new Intent("com.termux.RUN_COMMAND");
        probe.setPackage("com.termux");
        probe.putExtra("com.termux.RUN_COMMAND_PATH", "/system/bin/true");
        probe.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", new String[0]);
        probe.putExtra("com.termux.RUN_COMMAND_WORKDIR", "/data/data/com.termux/files/home");
        probe.putExtra("com.termux.RUN_COMMAND_BACKGROUND", true);
        probe.putExtra("com.termux.RUN_COMMAND_RESULT", true);
        PendingIntent probeIntent = PendingIntent.getBroadcast(
                getContext(),
                probeJobId.hashCode(),
                new Intent(getContext(), TermuxResultReceiver.class).putExtra("jobId", probeJobId),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        probe.putExtra("com.termux.RUN_COMMAND_RESULT_PENDINGINTENT", probeIntent);

        termuxCalls.put(probeJobId, call);
        // Probe watchdog. It resolves (not rejects) with a not-ready status, so
        // the status tool always gets a truthful answer instead of an error.
        Runnable probeWatchdog = new Runnable() {
            @Override
            public void run() {
                termuxTimeouts.remove(probeJobId);
                resolveTermuxStatus(probeJobId, buildStatusPayload(false, declared, "probe_timeout"));
            }
        };
        termuxTimeouts.put(probeJobId, probeWatchdog);
        termuxHandler.postDelayed(probeWatchdog, TERMUX_PROBE_TIMEOUT_MS);

        try {
            getContext().sendBroadcast(probe, "com.termux.permission.RUN_COMMAND");
        } catch (Exception e) {
            cancelTermuxTimeout(probeJobId);
            resolveTermuxStatus(probeJobId, buildStatusPayload(false, declared, "broadcast_failed"));
        }
    }

    /**
     * Resolves a parked readiness-probe call with its status payload. Removes
     * the call first so a call that was already rejected by handleOnDestroy (or
     * resolved by a late Termux reply) can never be settled twice.
     */
    private void resolveTermuxStatus(String jobId, JSObject payload) {
        PluginCall call = termuxCalls.remove(jobId);
        if (call == null) return;
        call.resolve(payload);
    }

    /**
     * Builds the honest status object. `responsive` means a real round trip
     * completed; `declared` is the termux.properties value, which is usually
     * unreadable from GIA's UID and therefore often null.
     */
    private JSObject buildStatusPayload(boolean responsive, Boolean declared, String reason) {
        // A completed round trip is proof the bridge works, whatever the
        // properties file claims (it is usually unreadable from GIA's UID).
        boolean ready = responsive || Boolean.TRUE.equals(declared);

        JSObject payload = new JSObject();
        payload.put("installed", true);
        payload.put("ready", ready);
        payload.put("bridgeResponsive", responsive);
        payload.put("allowExternalApps", ready);
        payload.put("declaredAllowExternalApps", declared == null ? JSONObject.NULL : declared);
        payload.put("reason", reason);
        payload.put("hint", ready
                ? (responsive
                    ? "Termux responded to a live probe; approved commands will run."
                    : "Termux declares allow-external-apps = true, but GIA could not confirm a live round trip.")
                : ALLOW_EXTERNAL_APPS_HINT);
        return payload;
    }

    @PluginMethod
    public void openTermux(PluginCall call) {
        Intent launch = getContext().getPackageManager().getLaunchIntentForPackage("com.termux");
        if (launch == null) {
            call.reject("Termux is not installed");
            return;
        }
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(launch);
        call.resolve();
    }

    @PluginMethod
    public void runTermuxCommand(PluginCall call) {
        String command = call.getString("command");
        if (command == null || command.trim().isEmpty()) {
            call.reject("command is required");
            return;
        }
        String jobId = UUID.randomUUID().toString();
        Intent run = new Intent("com.termux.RUN_COMMAND");
        run.setPackage("com.termux");
        run.putExtra("com.termux.RUN_COMMAND_PATH", command);
        JSONArray jsonArgs = call.getArray("args");
        String[] args = new String[jsonArgs == null ? 0 : jsonArgs.length()];
        if (jsonArgs != null) {
            try {
                for (int i = 0; i < jsonArgs.length(); i++) args[i] = jsonArgs.getString(i);
            } catch (Exception e) {
                call.reject("args must be an array of strings", e);
                return;
            }
        }
        run.putExtra("com.termux.RUN_COMMAND_ARGUMENTS", args);
        run.putExtra("com.termux.RUN_COMMAND_WORKDIR", call.getString("workdir", "/data/data/com.termux/files/home"));
        run.putExtra("com.termux.RUN_COMMAND_BACKGROUND", false);
        run.putExtra("com.termux.RUN_COMMAND_RESULT", true);
        PendingIntent resultIntent = PendingIntent.getBroadcast(
                getContext(),
                jobId.hashCode(),
                new Intent(getContext(), TermuxResultReceiver.class).putExtra("jobId", jobId),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        run.putExtra("com.termux.RUN_COMMAND_RESULT_PENDINGINTENT", resultIntent);
        try {
            termuxCalls.put(jobId, call);
            // Watchdog: if Termux never answers, reject and clean up instead of
            // leaving the JS promise pending forever.
            scheduleTermuxTimeout(jobId, TERMUX_TIMEOUT_MS,
                    "Termux did not respond within " + (TERMUX_TIMEOUT_MS / 1000)
                    + "s. " + ALLOW_EXTERNAL_APPS_HINT);
            getContext().sendBroadcast(run, "com.termux.permission.RUN_COMMAND");
        } catch (Exception e) {
            failTermuxCall(jobId, "Termux command could not be started: " + e.getMessage());
        }
    }
}
