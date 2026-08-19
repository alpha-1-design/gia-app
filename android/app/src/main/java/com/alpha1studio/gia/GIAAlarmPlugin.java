package com.alpha1studio.gia;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Calendar;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(
    name = "GIAAlarm",
    permissions = {
        @Permission(strings = {android.Manifest.permission.POST_NOTIFICATIONS}, alias = "notifications")
    }
)
public class GIAAlarmPlugin extends Plugin {

    private static final String PREFS_NAME = "GIAAlarms";
    private static final String ALARM_IDS_KEY = "alarm_ids";

    @PluginMethod
    public void setAlarm(PluginCall call) {
        int hour = call.getInt("hour", -1);
        int minute = call.getInt("minute", -1);

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("Invalid time: hour must be 0-23, minute 0-59");
            return;
        }

        String label = call.getString("label", "Alarm");

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                // BUG FIX: this used to call requestPermissionForAlias(...,
                // call, "9004") -- but Capacitor resolves that fourth
                // argument by looking for a method literally named "9004"
                // annotated @PermissionCallback, which never existed here.
                // Verified against Capacitor's own source (vendored in
                // node_modules): when no matching callback method is found,
                // it calls call.reject("There is no PermissionCallback
                // method registered for the name: 9004..."). So this
                // wasn't a silent hang -- any user who hit this path (i.e.
                // POST_NOTIFICATIONS not already granted from elsewhere in
                // the app) would have seen setAlarm() fail outright with
                // that internal error message instead of a real one. Fixed
                // by adding a properly-named, properly-annotated callback
                // below and threading the alarm args through it so the
                // request can actually resume after the permission prompt.
                call.getData().put("_gia_hour", hour);
                call.getData().put("_gia_minute", minute);
                call.getData().put("_gia_label", label);
                requestPermissionForAlias("notifications", call, "onNotificationPermissionResult");
                return;
            }
        }

        scheduleAlarm(call, hour, minute, label);
    }

    @PermissionCallback
    private void onNotificationPermissionResult(PluginCall call) {
        if (call == null) return;
        int hour = call.getInt("_gia_hour", -1);
        int minute = call.getInt("_gia_minute", -1);
        String label = call.getString("_gia_label", "Alarm");
        if (hour < 0 || minute < 0) {
            call.reject("Alarm request lost after permission prompt -- please try again.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(getContext(), android.Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
            call.reject("Notification permission is required for alarms to alert you -- without it, the alarm can be scheduled but won't be able to show or sound.");
            return;
        }
        scheduleAlarm(call, hour, minute, label);
    }

    private void scheduleAlarm(PluginCall call, int hour, int minute, String label) {

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (am != null && !am.canScheduleExactAlarms()) {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.reject("SCHEDULE_EXACT_ALARM permission required");
                return;
            }
        }

        try {
            Calendar now = Calendar.getInstance();
            Calendar calendar = Calendar.getInstance();
            calendar.set(Calendar.HOUR_OF_DAY, hour);
            calendar.set(Calendar.MINUTE, minute);
            calendar.set(Calendar.SECOND, 0);
            calendar.set(Calendar.MILLISECOND, 0);

            if (calendar.before(now)) {
                calendar.add(Calendar.DATE, 1);
            }

            int requestCode = (int) (System.currentTimeMillis() % Integer.MAX_VALUE);

            Intent alarmIntent = new Intent(getContext(), GIAAlarmReceiver.class);
            alarmIntent.putExtra("label", label);
            alarmIntent.putExtra("requestCode", requestCode);

            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(), requestCode, alarmIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                call.reject("Alarm service not available");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
            }

            persistAlarm(getContext(), requestCode, hour, minute, label);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("method", "alarm_manager");
            ret.put("alarmId", requestCode);
            ret.put("time", calendar.getTimeInMillis());
            call.resolve(ret);
        } catch (SecurityException e) {
            call.reject("Alarm permission denied: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Failed to set alarm: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        int alarmId = call.getInt("alarmId", -1);
        if (alarmId < 0) {
            call.reject("Valid alarmId is required");
            return;
        }

        try {
            Intent alarmIntent = new Intent(getContext(), GIAAlarmReceiver.class);
            PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(), alarmId, alarmIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_NO_CREATE
            );

            if (pendingIntent != null) {
                AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    alarmManager.cancel(pendingIntent);
                }
                pendingIntent.cancel();
            }

            removePersistedAlarm(getContext(), alarmId);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to cancel alarm: " + e.getMessage());
        }
    }

    static void persistAlarm(Context context, int requestCode, int hour, int minute, String label) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String id = String.valueOf(requestCode);
        prefs.edit()
            .putInt(id + "_hour", hour)
            .putInt(id + "_minute", minute)
            .putString(id + "_label", label)
            .putLong(id + "_time", System.currentTimeMillis())
            .apply();
        Set<String> ids = new HashSet<>(prefs.getStringSet(ALARM_IDS_KEY, new HashSet<>()));
        ids.add(id);
        prefs.edit().putStringSet(ALARM_IDS_KEY, ids).apply();
    }

    static void removePersistedAlarm(Context context, int requestCode) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String id = String.valueOf(requestCode);
        Set<String> ids = new HashSet<>(prefs.getStringSet(ALARM_IDS_KEY, new HashSet<>()));
        ids.remove(id);
        prefs.edit()
            .remove(id + "_hour")
            .remove(id + "_minute")
            .remove(id + "_label")
            .remove(id + "_time")
            .putStringSet(ALARM_IDS_KEY, ids)
            .apply();
    }

    static void reRegisterAlarms(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        Set<String> ids = prefs.getStringSet(ALARM_IDS_KEY, new HashSet<>());
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        for (String id : ids) {
            try {
                int requestCode = Integer.parseInt(id);
                int hour = prefs.getInt(id + "_hour", 0);
                int minute = prefs.getInt(id + "_minute", 0);
                String label = prefs.getString(id + "_label", "Alarm");

                Calendar now = Calendar.getInstance();
                Calendar calendar = Calendar.getInstance();
                calendar.set(Calendar.HOUR_OF_DAY, hour);
                calendar.set(Calendar.MINUTE, minute);
                calendar.set(Calendar.SECOND, 0);
                calendar.set(Calendar.MILLISECOND, 0);

                if (calendar.before(now)) {
                    calendar.add(Calendar.DATE, 1);
                }

                Intent alarmIntent = new Intent(context, GIAAlarmReceiver.class);
                alarmIntent.putExtra("label", label);
                alarmIntent.putExtra("requestCode", requestCode);

                PendingIntent pendingIntent = PendingIntent.getBroadcast(
                    context, requestCode, alarmIntent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                );

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, calendar.getTimeInMillis(), pendingIntent);
                }
            } catch (Exception ignored) {
                // skip malformed alarm entries
            }
        }
    }
}
