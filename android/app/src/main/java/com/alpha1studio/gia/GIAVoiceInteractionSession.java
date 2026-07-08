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

    @Override
    public void onHandleAssist(Bundle args) {
        Log.i(TAG, "Session assist — forwarding to MainActivity");
        Intent intent = new Intent(getContext(), MainActivity.class);
        intent.setAction(Intent.ACTION_ASSIST);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (args != null) {
            intent.putExtras(args);
        }
        intent.putExtra("source", "voice_assist");
        getContext().startActivity(intent);
    }
}
