package com.alpha1studio.gia;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.util.Log;

/**
 * BroadcastReceiver for incoming SMS messages.
 *
 * Receives android.provider.Telephony.SMS_RECEIVED intents and forwards
 * parsed messages to the GIASMSPlugin for delivery to the WebView layer.
 */
public class GIASMSReceiver extends BroadcastReceiver {

    private static final String TAG = "GIASMSReceiver";
    private static volatile GIASMSPlugin pluginRef = null;

    public static void setPluginRef(GIASMSPlugin plugin) {
        pluginRef = plugin;
    }

    public static void clearPluginRef() {
        pluginRef = null;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!"android.provider.Telephony.SMS_RECEIVED".equals(intent.getAction())) {
            return;
        }

        Bundle bundle = intent.getExtras();
        if (bundle == null) return;

        Object[] pdus = (Object[]) bundle.get("pdus");
        if (pdus == null || pdus.length == 0) return;

        StringBuilder fullBody = new StringBuilder();
        String sender = null;
        long timestamp = 0;

        for (Object pdu : pdus) {
            SmsMessage sms = SmsMessage.createFromPdu((byte[]) pdu);
            if (sms == null) continue;

            if (sender == null) {
                sender = sms.getOriginatingAddress();
            }
            if (timestamp == 0) {
                timestamp = sms.getTimestampMillis();
            }
            fullBody.append(sms.getMessageBody());
        }

        if (fullBody.length() == 0) return;

        Log.i(TAG, "SMS received from " + sender + ": " + fullBody.length() + " chars");

        GIASMSPlugin ref = pluginRef;
        if (ref != null) {
            try {
                com.getcapacitor.JSObject payload = new com.getcapacitor.JSObject();
                payload.put("from", sender != null ? sender : "unknown");
                payload.put("body", fullBody.toString());
                payload.put("timestamp", timestamp);
                ref.notifyListeners("smsReceived", payload);
            } catch (Exception e) {
                Log.e(TAG, "Failed to forward SMS to plugin", e);
            }
        }
    }
}
