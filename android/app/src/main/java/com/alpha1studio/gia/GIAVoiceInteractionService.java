package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionService;
import android.util.Log;

/**
 * Makes GIA selectable as the device's default voice assistant
 * (Settings -> Apps -> Default apps -> Assistant). When the user triggers the
 * assistant (long-press home, swipe-up, "Hey Google" redirect, etc.) the
 * system calls {@link #onPrepareToShowSession}; we delegate to MainActivity, which
 * hosts the React/WebView UI, rather than rendering a separate native session
 * window. The assist is then surfaced to the web layer through GIAIntentPlugin
 * (ACTION_ASSIST -> onAssist listener -> chat voice input).
 */
public class GIAVoiceInteractionService extends VoiceInteractionService {

    private static final String TAG = "GIAVoiceInteractionService";
    private static final String EXTRA_SOURCE = "source";

    @Override
    public void onReady() {
        super.onReady();
        Log.i(TAG, "GIA is now the active default assistant");
        // Keep GIA alive in the background and start the wake-word listener so
        // the assistant stays responsive even when the WebView is backgrounded.
        Intent core = new Intent(this, GIACoreService.class);
        core.putExtra("startWakeWord", true);
        startService(core);
    }

    @Override
    public void onShutdown() {
        super.onShutdown();
        Log.i(TAG, "GIA assistant service shutting down");
    }

    @Override
    public void onPrepareToShowSession(Bundle args, int flags) {
        // Delegate the assistant UI to the main activity (the React WebView).
        // We intentionally do NOT call super.onPrepareToShowSession() so no empty native
        // session window is shown.
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_ASSIST);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (args != null) {
            intent.putExtras(args);
        }
        intent.putExtra(EXTRA_SOURCE, "voice_assist");
        startActivity(intent);
    }

    @Override
    public void onLaunchVoiceAssistFromKeyguard() {
        Intent intent = new Intent(this, MainActivity.class);
        intent.setAction(Intent.ACTION_ASSIST);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra(EXTRA_SOURCE, "keyguard_assist");
        startActivity(intent);
    }
}
