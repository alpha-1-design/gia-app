package com.alpha1studio.gia.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

import com.alpha1studio.gia.MainActivity;
import com.alpha1studio.gia.R;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * GIA home-screen widget (classic AppWidgetProvider + RemoteViews).
 *
 * Replaces the previous Jetpack Glance implementation: the glance artifacts
 * published to Google Maven expose a pre-1.0 API that does not contain the
 * symbols the Glance-based widget was written against (dp/sp/em, Arrangement,
 * weight, Preferences, updateAppWidgetState, updateAllInstances, ...), which
 * broke assembleDebug. A plain AppWidgetProvider uses only android.* APIs and
 * resources, needs no extra dependencies, and matches the rest of the native
 * code (Java) in this project.
 *
 * State (provider pill, next task, battery, storage) is pushed from the JS
 * layer via {@code GIAWidgetPlugin.update(...)}, which persists it here and
 * re-renders every placed instance. The clock refreshes on each render and on
 * the 30-minute system update tick.
 */
public class GIAWidgetProvider extends AppWidgetProvider {

    private static final String PREFS = "gia_widget_prefs";
    private static final String KEY_CONNECTED = "providerConnected";
    private static final String KEY_PROVIDER = "providerName";
    private static final String KEY_NEXT_TASK = "nextTask";
    private static final String KEY_BATTERY = "battery";
    private static final String KEY_STORAGE = "storage";

    private static final int REQ_VOICE = 1001;
    private static final int REQ_CAPTURE = 1002;
    private static final int REQ_CHAT = 1003;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        RemoteViews views = buildViews(context, prefs);
        for (int id : appWidgetIds) {
            appWidgetManager.updateAppWidget(id, views);
        }
    }

    @Override
    public void onEnabled(Context context) {
        // First placement — render real content instead of just the initial layout.
        updateAllWidgets(context, context.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
    }

    /**
     * Persist the latest snapshot and re-render every placed instance.
     * Invoked from {@code GIAWidgetPlugin} when the JS side detects a
     * provider/task change (debounced in WidgetSyncService).
     */
    public static void updateAll(Context context, boolean providerConnected, String providerName,
                                 String nextTask, int battery, String storage) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(KEY_CONNECTED, providerConnected)
                .putString(KEY_PROVIDER, providerName)
                .putString(KEY_NEXT_TASK, nextTask)
                .putInt(KEY_BATTERY, battery)
                .putString(KEY_STORAGE, storage)
                .apply();
        updateAllWidgets(context, context.getSharedPreferences(PREFS, Context.MODE_PRIVATE));
    }

    private static void updateAllWidgets(Context context, SharedPreferences prefs) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, GIAWidgetProvider.class));
        if (ids.length == 0) return;
        RemoteViews views = buildViews(context, prefs);
        for (int id : ids) {
            manager.updateAppWidget(id, views);
        }
    }

    private static RemoteViews buildViews(Context context, SharedPreferences prefs) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_gia);

        long now = System.currentTimeMillis();
        views.setTextViewText(R.id.widget_time,
                new SimpleDateFormat("HH:mm", Locale.getDefault()).format(new Date(now)));
        views.setTextViewText(R.id.widget_date,
                new SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(new Date(now)));

        boolean connected = prefs.getBoolean(KEY_CONNECTED, false);
        String providerName = prefs.getString(KEY_PROVIDER, "GIA");
        views.setTextViewText(R.id.widget_provider, providerName);
        views.setTextColor(R.id.widget_provider, connected ? 0xFF34D399 : 0xFFF87171);

        int battery = prefs.getInt(KEY_BATTERY, -1);
        String storage = prefs.getString(KEY_STORAGE, null);
        views.setTextViewText(R.id.widget_battery,
                battery > 0 ? "\uD83D\uDD0B " + battery + "%" : "\uD83D\uDD0B N/A");
        views.setTextViewText(R.id.widget_storage, storage != null ? "\uD83D\uDCBE " + storage : "");

        String nextTask = prefs.getString(KEY_NEXT_TASK, null);
        if (nextTask == null || nextTask.isEmpty()) {
            views.setViewVisibility(R.id.widget_next_task, View.GONE);
        } else {
            views.setViewVisibility(R.id.widget_next_task, View.VISIBLE);
            views.setTextViewText(R.id.widget_next_task, "\uD83C\uDFAF " + nextTask);
        }

        views.setOnClickPendingIntent(R.id.widget_voice, actionIntent(context, REQ_VOICE, "voice_start"));
        views.setOnClickPendingIntent(R.id.widget_capture, actionIntent(context, REQ_CAPTURE, "screen_capture"));
        views.setOnClickPendingIntent(R.id.widget_chat, actionIntent(context, REQ_CHAT, "open_chat"));

        return views;
    }

    /**
     * Open MainActivity with a custom "action" extra. GIAIntentPlugin reads
     * that extra and forwards it to JS as an "onWidgetAction" event, which
     * {@code handleWidgetAction()} in useNativeIntents.ts dispatches
     * (voice_start / screen_capture / open_chat).
     */
    private static PendingIntent actionIntent(Context context, int requestCode, String action) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_LAUNCHER);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("action", action);
        return PendingIntent.getActivity(context, requestCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
