package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionSession;

public class GIAVoiceInteractionSession extends VoiceInteractionSession {

    public GIAVoiceInteractionSession(GIAVoiceInteractionService service) {
        super(service);
    }

    @Override
    public void onInit(Bundle args) {
        super.onInit(args);
    }

    @Override
    public void onLaunchVoiceAssistFromKeyguard() {
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("source", "session_keyguard_assist");
        getContext().startActivity(intent);
    }
}
