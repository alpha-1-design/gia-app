package com.alpha1studio.gia;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * GIATerminalPlugin - Capacitor bridge to GIATerminalService.
 *
 * Provides exec, kill, listSessions, getFSInfo, and getStatus methods
 * that manage proot+Alpine terminal sessions running in a foreground service.
 */
@CapacitorPlugin(name = "GIATerminal")
public class GIATerminalPlugin extends Plugin {

    private static final String TAG = "GIATerminalPlugin";

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "GIATerminalPlugin loaded");
        startTerminalService();
    }

    /**
     * Start the foreground terminal service.
     *
     * Deliberately swallows any exception here. This runs inside load(),
     * which Capacitor calls while registering the plugin with the bridge —
     * an uncaught exception at this point can knock the plugin registration
     * itself out, which is what makes JS see "GIATerminal plugin is not
     * implemented on android" instead of a real error from exec(). Service
     * start failures now surface as a normal call rejection the next time
     * exec() is used, instead of poisoning plugin availability app-wide.
     */
    private void startTerminalService() {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, GIATerminalService.class);
            context.startForegroundService(serviceIntent);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start GIATerminalService: " + e.getMessage(), e);
        }
    }

    /**
     * Execute a command inside a proot+Alpine terminal session.
     *
     * @param call Expects: command (string, required), workdir (string, optional),
     *             env (JSObject, optional), timeout (number, optional),
     *             sessionId (string, optional — auto-generated if omitted)
     */
    @PluginMethod
    public void exec(PluginCall call) {
        String command = call.getString("command");
        if (command == null || command.isEmpty()) {
            call.reject("command is required");
            return;
        }

        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            sessionId = UUID.randomUUID().toString();
        }
        int timeout = call.getInt("timeout", 30000); // default 30s

        try {
            // Start the session
            GIATerminalService.TerminalSession session =
                    GIATerminalService.startSession(getContext(), sessionId, command);

            // Wait for output with timeout
            String output = session.awaitOutput(timeout);

            // Give the OS a short grace window to reap the child before reading
            // its exit code. Previously we called process.exitValue() directly
            // after stream EOF, which races the JVM's reaper thread and throws
            // IllegalThreadStateException("process hasn't exited") — surfacing
            // as "Unexpected error: process hasn't exited" on every command.
            boolean exited = session.awaitExit(2000);
            int exitCode = session.exitCode();
            if (!exited) {
                output += "\n[command still running after " + timeout + "ms — session terminated]";
            }

            // Clean up the session
            GIATerminalService.killSession(sessionId);

            JSObject result = new JSObject();
            result.put("output", output);
            result.put("exitCode", exitCode);
            result.put("sessionId", sessionId);
            call.resolve(result);

        } catch (IOException e) {
            Log.e(TAG, "Failed to start session", e);
            call.reject("Failed to start terminal session: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Log.e(TAG, "Session interrupted", e);
            GIATerminalService.killSession(sessionId);
            call.reject("Terminal session interrupted", e);
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error in exec", e);
            GIATerminalService.killSession(sessionId);
            call.reject("Unexpected error: " + e.getMessage(), e);
        }
    }

    /**
     * Kill a terminal session by sessionId.
     *
     * @param call Expects: sessionId (string, required)
     */
    @PluginMethod
    public void kill(PluginCall call) {
        String sessionId = call.getString("sessionId");
        if (sessionId == null || sessionId.isEmpty()) {
            call.reject("sessionId is required");
            return;
        }

        try {
            GIATerminalService.killSession(sessionId);
            JSObject result = new JSObject();
            result.put("killed", true);
            result.put("sessionId", sessionId);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to kill session " + sessionId, e);
            call.reject("Failed to kill session: " + e.getMessage(), e);
        }
    }

    /**
     * List all active terminal sessions.
     */
    @PluginMethod
    public void listSessions(PluginCall call) {
        try {
            List<Map<String, Object>> sessions = GIATerminalService.listSessions();
            JSArray jsSessions = new JSArray();

            for (Map<String, Object> s : sessions) {
                JSObject obj = new JSObject();
                obj.put("sessionId", (String) s.get("sessionId"));
                obj.put("command", (String) s.get("command"));
                obj.put("createdAt", (Long) s.get("createdAt"));
                obj.put("running", (Boolean) s.get("running"));
                jsSessions.put(obj);
            }

            JSObject result = new JSObject();
            result.put("sessions", jsSessions);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to list sessions", e);
            call.reject("Failed to list sessions: " + e.getMessage(), e);
        }
    }

    /**
     * Get filesystem info for the terminal directory.
     */
    @PluginMethod
    public void getFSInfo(PluginCall call) {
        try {
            Map<String, Object> fsInfo = GIATerminalService.getFSInfo(getContext());

            JSObject result = new JSObject();
            result.put("totalBytes", (Long) fsInfo.get("totalBytes"));
            result.put("freeBytes", (Long) fsInfo.get("freeBytes"));
            result.put("usedBytes", (Long) fsInfo.get("usedBytes"));
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get FS info", e);
            call.reject("Failed to get filesystem info: " + e.getMessage(), e);
        }
    }

    /**
     * Get terminal service status: running state and session count.
     */
    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            int sessionCount = GIATerminalService.getSessionCount();

            JSObject result = new JSObject();
            result.put("running", true);
            result.put("sessionCount", sessionCount);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Failed to get status", e);
            call.reject("Failed to get status: " + e.getMessage(), e);
        }
    }

    /**
     * Force-delete the rootfs and re-extract from assets on a background thread.
     * 
     * This breaks the chicken-and-egg where a broken rootfs prevents
     * provisioning (which needs a working terminal) but a working terminal
     * needs a good rootfs.
     */
    @PluginMethod
    public void reinstallRootfs(PluginCall call) {
        new Thread(() -> {
            try {
                boolean ok = GIATerminalService.forceReextractRootfs(getContext());
                if (ok) {
                    JSObject result = new JSObject();
                    result.put("success", true);
                    result.put("message", "Rootfs re-extracted successfully");
                    call.resolve(result);
                } else {
                    call.reject("Rootfs re-extraction completed but critical binaries are missing");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to reinstall rootfs", e);
                call.reject("Failed to reinstall rootfs: " + e.getMessage(), e);
            }
        }, "rootfs-reinstall").start();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        Log.i(TAG, "GIATerminalPlugin destroyed");
    }
}
