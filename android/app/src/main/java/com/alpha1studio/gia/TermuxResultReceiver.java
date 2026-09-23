package com.alpha1studio.gia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class TermuxResultReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String jobId = intent.getStringExtra("jobId");
        if (jobId != null) GIAIntentPlugin.deliverTermuxResult(jobId, intent.getExtras());
    }
}
