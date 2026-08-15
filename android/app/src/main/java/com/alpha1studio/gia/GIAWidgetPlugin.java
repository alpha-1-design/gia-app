package com.alpha1studio.gia;

import android.content.Context;
import android.os.BatteryManager;
import android.os.Environment;
import android.os.StatFs;

import com.alpha1studio.gia.widget.GIAWidgetProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.text.DecimalFormat;

/**
 * GIAWidget — keeps the home-screen widget in sync with live app state.
 *
 * The JS side calls {@link #update} whenever the active provider or the next
 * task changes (debounced in WidgetSyncService). Battery level and free
 * storage are read natively here so the widget doesn't depend on the JS layer
 * for device metrics.
 */
@CapacitorPlugin(name = "GIAWidget")
public class GIAWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        Context context = getContext().getApplicationContext();
        boolean connected = call.getBoolean("providerConnected", false);
        String providerName = call.getString("providerName", "GIA");
        String nextTask = call.getString("nextTask");

        GIAWidgetProvider.updateAll(
                context,
                connected,
                providerName,
                nextTask,
                readBattery(context),
                readStorage(context)
        );
        call.resolve();
    }

    private int readBattery(Context context) {
        try {
            BatteryManager bm = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
            return bm != null ? bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private String readStorage(Context context) {
        try {
            StatFs stat = new StatFs(Environment.getDataDirectory().getAbsolutePath());
            double freeGb = (double) stat.getAvailableBytes() / (1024.0 * 1024.0 * 1024.0);
            return new DecimalFormat("0.0").format(freeGb) + " GB free";
        } catch (Exception e) {
            return "N/A";
        }
    }
}
