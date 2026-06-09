package com.alpha1studio.gia;

import android.service.voice.VoiceInteractionSession;

public class GIAVoiceInteractionSession extends VoiceInteractionSession {

    public GIAVoiceInteractionSession(GIAVoiceInteractionService service) {
        super(service);
    }

    @Override
    public void onCreate() {
        super.onCreate();
    }
}
