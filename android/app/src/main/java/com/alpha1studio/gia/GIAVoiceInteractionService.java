package com.alpha1studio.gia;

import android.content.Intent;
import android.os.Bundle;
import android.service.voice.VoiceInteractionService;

public class GIAVoiceInteractionService extends VoiceInteractionService {

    @Override
    public void onReady() {
        super.onReady();
        // Called when GIA is set as the default assistant
        // The service is now active and can handle ASSIST intents
    }

    @Override
    public void onShutdown() {
        super.onShutdown();
    }

    @Override
    public void onLaunchVoiceAssistFromKeyguard() {
        // User launched from lock screen
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("source", "keyguard_assist");
        startActivity(intent);
    }

    @Override
    public void onPrepareToShowSession(Bundle args, int typeFlags) {
        // GIA handles showing sessions differently — no-op here
    }
}
