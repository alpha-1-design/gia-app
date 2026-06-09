package com.alpha1studio.gia;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.ArrayList;

@CapacitorPlugin(
    name = "GIASMS",
    permissions = {
        @Permission(strings = {Manifest.permission.SEND_SMS}, alias = "sms")
    }
)
public class GIASMSPlugin extends Plugin {

    private static final int SMS_PERMISSION_REQUEST = 9003;
    private static final String SMS_SENT_ACTION = "GIA_SMS_SENT";

    @PluginMethod
    public void sendSMS(PluginCall call) {
        String phone = call.getString("phone", "");
        String message = call.getString("message", "");

        if (phone.isEmpty() || message.isEmpty()) {
            call.reject("Phone and message are required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.SEND_SMS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("sms", call, SMS_PERMISSION_REQUEST);
                return;
            }
        }

        sendSmsInternal(call, phone, message);
    }

    private void sendSmsInternal(PluginCall call, String phone, String message) {
        try {
            SmsManager smsManager = SmsManager.getDefault();

            PendingIntent sentIntent = PendingIntent.getBroadcast(
                getContext(), phone.hashCode(),
                new Intent(SMS_SENT_ACTION).putExtra("callId", call.getData().toString()),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            if (message.length() > 160) {
                ArrayList<String> parts = smsManager.divideMessage(message);
                ArrayList<PendingIntent> sentIntents = new ArrayList<>();
                for (int i = 0; i < parts.size(); i++) {
                    sentIntents.add(sentIntent);
                }
                smsManager.sendMultipartTextMessage(phone, null, parts, sentIntents, null);
            } else {
                smsManager.sendTextMessage(phone, null, message, sentIntent, null);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("method", "sms_manager");
            call.resolve(ret);
        } catch (Exception e) {
            String msg = e.getMessage();
            if (e instanceof UnsupportedOperationException) {
                msg = "SMS not supported on this device (no telephony hardware)";
            }
            call.reject("Failed to send SMS: " + msg);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == SMS_PERMISSION_REQUEST) {
            PluginCall savedCall = getSavedCall(SMS_PERMISSION_REQUEST);
            if (savedCall != null) {
                if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                    String phone = savedCall.getString("phone", "");
                    String message = savedCall.getString("message", "");
                    sendSmsInternal(savedCall, phone, message);
                } else {
                    savedCall.reject("SMS permission denied by user");
                }
                freeSavedCall(SMS_PERMISSION_REQUEST);
            }
        }
    }
}
