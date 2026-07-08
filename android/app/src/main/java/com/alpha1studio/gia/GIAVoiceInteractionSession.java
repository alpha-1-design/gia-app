package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionSession;
import android.util.Log;

/**
 * Defensive fallback session. In the normal flow the service's
 * {@link GIAVoiceInteractionService#onShowSession} delegates straight to
 * MainActivity, so this session is usually never shown. If the system does
 * show it, forward the assist to the main activity the same way.
 */
public class GIAVoiceInteractionSession extends VoiceInteractionSession {

    private static final String TAG = "GIAVoiceInteractionSession";

    public GIAVoiceInteractionSession(GIAVoiceInteractionService service) {
        super(service);
    }

    @Override
    public void onCreate() {
        super.onCreate();
    }
}
