package com.alpha1studio.gia

import android.content.Context
import android.os.BatteryManager
import android.os.Environment
import android.os.StatFs
import com.alpha1studio.gia.widget.GIAAppWidget
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.text.DecimalFormat

/**
 * GIAWidget — keeps the home-screen Glance widget in sync with live app state.
 *
 * The JS side calls [update] whenever the active provider or the next task
 * changes (debounced). Battery level and free storage are read natively here
 * so the widget doesn't depend on the JS layer for device metrics.
 */
@CapacitorPlugin(name = "GIAWidget")
class GIAWidgetPlugin : Plugin() {

    @PluginMethod
    fun update(call: PluginCall) {
        val context = context.applicationContext
        val connected = call.getBoolean("providerConnected", false)
        val providerName = call.getString("providerName") ?: "GIA"
        val nextTask = call.getString("nextTask")
        val battery = readBattery(context)
        val storage = readStorage(context)

        CoroutineScope(Dispatchers.IO).launch {
            GIAAppWidget.updateState(context, connected, providerName, nextTask, battery, storage)
            call.resolve()
        }
    }

    private fun readBattery(context: Context): Int {
        return try {
            val bm = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
            bm?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: -1
        } catch (e: Exception) {
            -1
        }
    }

    private fun readStorage(context: Context): String {
        return try {
            val stat = StatFs(Environment.getDataDirectory().absolutePath)
            val freeBytes = stat.availableBytes.toDouble()
            val freeGb = freeBytes / (1024.0 * 1024.0 * 1024.0)
            "${DecimalFormat("0.0").format(freeGb)} GB free"
        } catch (e: Exception) {
            "N/A"
        }
    }
}
