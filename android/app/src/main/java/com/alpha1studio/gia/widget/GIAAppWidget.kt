package com.alpha1studio.gia.widget

import android.content.Context
import android.content.Intent
import android.text.format.DateFormat
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.currentState
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Arrangement
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.weight
import androidx.glance.state.Preferences
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextOverflow
import androidx.glance.text.TextStyle
import androidx.glance.unit.dp
import androidx.glance.unit.em
import androidx.glance.unit.sp

class GIAAppWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, glanceId: GlanceId) {
        provideContent {
            val prefs = currentState<Preferences>()
            val time = DateFormat.format("HH:mm", System.currentTimeMillis()).toString()
            val date = DateFormat.format("EEE, MMM d", System.currentTimeMillis()).toString()

            val weather = prefs.getString("weather") ?: "Loading…"
            val temp = prefs.getString("temp") ?: "--°"
            val condition = prefs.getString("condition") ?: ""

            val battery = prefs.getInt("battery", -1)
            val storage = prefs.getString("storage") ?: "Checking…"

            val nextTask = prefs.getString("nextTask") ?: "No upcoming tasks"

            val providerConnected = prefs.getBoolean("providerConnected", false)
            val providerName = prefs.getString("providerName") ?: "None"

            GIAWidgetTheme {
                Box(
                    modifier = GlanceModifier
                        .fillMaxSize()
                        .background(GIAWidgetTheme.colors.background)
                        .padding(16.dp)
                ) {
                    Column(
                        modifier = GlanceModifier.fillMaxSize(),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = GlanceModifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column {
                                Text(
                                    text = time,
                                    style = TextStyle(
                                        fontSize = 48.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = GIAWidgetTheme.colors.onBackground
                                    )
                                )
                                Text(
                                    text = date,
                                    style = TextStyle(
                                        fontSize = 14.sp,
                                        color = GIAWidgetTheme.colors.onBackground.copy(alpha = 0.6f)
                                    )
                                )
                            }

                            ProviderPill(connected = providerConnected, name = providerName)
                        }

                        WeatherCard(weather = weather, temp = temp, condition = condition)
                        DeviceHealthRow(battery = battery, storage = storage)
                        NextTaskCard(task = nextTask)
                        QuickActionsRow(
                            onVoiceClick = actionStartVoice,
                            onCaptureClick = actionCaptureScreen,
                            onChatClick = actionOpenChat
                        )
                    }
                }
            }
        }
    }

    companion object {
        @JvmStatic
        fun updateAllWidgets(context: Context) {
            val manager = GlanceAppWidgetManager(context)
            manager.updateAllInstances(GIAAppWidget())
        }
    }
}

// ============================================================
// THEME
// ============================================================

class GIAWidgetTheme {
    object colors {
        val background = Color(0xFF0A0A0F)
        val surface = Color(0xFF111118)
        val surfaceVariant = Color(0xFF18181F)
        val onBackground = Color(0xFFF0F0F5)
        val onSurface = Color(0xFFE0E0E8)
        val primary = Color(0xFFA855F7)
        val primaryContainer = Color(0xFF3B1A5C)
        val secondary = Color(0xFF06B6D4)
        val accent = Color(0xFFEC4899)
        val success = Color(0xFF10B981)
        val warning = Color(0xFFF59E0B)
        val error = Color(0xFFEF4444)
        val outline = Color(0xFF2A2A3A)
        val outlineVariant = Color(0xFF3A3A4A)
    }
}

@Composable
fun GIAWidgetTheme(content: @Composable () -> Unit) {
    content()
}

// ============================================================
// COMPOSABLES
// ============================================================

@Composable
fun ProviderPill(connected: Boolean, name: String) {
    val colors = GIAWidgetTheme.colors
    val pillColor = if (connected) colors.success else colors.outlineVariant
    val dotColor = if (connected) colors.onBackground else colors.onBackground.copy(alpha = 0.5f)
    val dot = if (connected) "\u25CF" else "\u25CB"

    Box(
        modifier = GlanceModifier
            .background(pillColor)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row {
            Text(
                text = dot,
                modifier = GlanceModifier.padding(end = 6.dp),
                style = TextStyle(
                    fontSize = 12.sp,
                    color = dotColor,
                    fontWeight = FontWeight.Bold
                )
            )
            Text(
                text = name.uppercase(),
                style = TextStyle(
                    fontSize = 10.sp,
                    color = dotColor,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.5.em
                )
            )
        }
    }
}

@Composable
fun WeatherCard(weather: String, temp: String, condition: String) {
    val colors = GIAWidgetTheme.colors
    Box(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(colors.surface)
            .padding(16.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.Start
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "WEATHER",
                    style = TextStyle(
                        fontSize = 10.sp,
                        color = colors.onSurface.copy(alpha = 0.5f),
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.5.em
                    )
                )
                Text(
                    text = temp,
                    style = TextStyle(
                        fontSize = 28.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary
                    )
                )
            }

            Row(
                modifier = GlanceModifier.fillMaxWidth()
            ) {
                Text(
                    text = condition,
                    modifier = GlanceModifier.padding(end = 8.dp),
                    style = TextStyle(
                        fontSize = 13.sp,
                        color = colors.onSurface
                    )
                )
                Text(
                    text = weather,
                    style = TextStyle(
                        fontSize = 13.sp,
                        color = colors.onSurface.copy(alpha = 0.7f)
                    )
                )
            }
        }
    }
}

@Composable
fun DeviceHealthRow(battery: Int, storage: String) {
    val colors = GIAWidgetTheme.colors
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(vertical = 8.dp)
    ) {
        val batteryColor = when {
            battery >= 50 -> colors.success
            battery >= 20 -> colors.warning
            battery > 0 -> colors.error
            else -> colors.outlineVariant
        }

        HealthPill(
            icon = "\uD83D\uDD0B",
            label = "BATTERY",
            value = if (battery > 0) "$battery%" else "N/A",
            valueColor = batteryColor,
            modifier = GlanceModifier.weight(1f).padding(end = 6.dp)
        )
        HealthPill(
            icon = "\uD83D\uDCBE",
            label = "STORAGE",
            value = storage,
            valueColor = colors.onSurface,
            modifier = GlanceModifier.weight(1f).padding(start = 6.dp)
        )
    }
}

@Composable
fun HealthPill(icon: String, label: String, value: String, valueColor: Color, modifier: GlanceModifier = GlanceModifier) {
    val colors = GIAWidgetTheme.colors
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(colors.surfaceVariant)
            .padding(12.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = icon,
                style = TextStyle(fontSize = 18.sp)
            )
            Text(
                text = label,
                style = TextStyle(
                    fontSize = 9.sp,
                    color = colors.onSurface.copy(alpha = 0.5f),
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 0.5.em
                )
            )
            Text(
                text = value,
                style = TextStyle(
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = valueColor
                )
            )
        }
    }
}

@Composable
fun NextTaskCard(task: String) {
    val colors = GIAWidgetTheme.colors
    Box(
        modifier = GlanceModifier
            .fillMaxWidth()
            .background(colors.primaryContainer)
            .padding(16.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.Start
        ) {
            Row(
                modifier = GlanceModifier.fillMaxWidth()
            ) {
                Text(
                    text = "\uD83C\uDFAF",
                    modifier = GlanceModifier.padding(end = 8.dp),
                    style = TextStyle(fontSize = 18.sp)
                )
                Text(
                    text = "NEXT UP",
                    style = TextStyle(
                        fontSize = 10.sp,
                        color = colors.primary,
                        fontWeight = FontWeight.Medium,
                        letterSpacing = 0.5.em
                    )
                )
            }
            Text(
                text = task,
                style = TextStyle(
                    fontSize = 14.sp,
                    color = colors.onSurface
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
fun QuickActionsRow(
    onVoiceClick: Action,
    onCaptureClick: Action,
    onChatClick: Action
) {
    Row(
        modifier = GlanceModifier
            .fillMaxWidth()
            .padding(top = 4.dp)
    ) {
        ActionButton(
            icon = "\uD83C\uDF99",
            label = "VOICE",
            color = GIAWidgetTheme.colors.primary,
            onClick = onVoiceClick,
            modifier = GlanceModifier.weight(1f).padding(end = 4.dp)
        )
        ActionButton(
            icon = "\uD83D\uDCF8",
            label = "CAPTURE",
            color = GIAWidgetTheme.colors.secondary,
            onClick = onCaptureClick,
            modifier = GlanceModifier.weight(1f).padding(horizontal = 4.dp)
        )
        ActionButton(
            icon = "\uD83D\uDCAC",
            label = "CHAT",
            color = GIAWidgetTheme.colors.accent,
            onClick = onChatClick,
            modifier = GlanceModifier.weight(1f).padding(start = 4.dp)
        )
    }
}

@Composable
fun ActionButton(icon: String, label: String, color: Color, onClick: Action, modifier: GlanceModifier = GlanceModifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(color)
            .padding(vertical = 14.dp)
            .clickable(onClick)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = icon,
                style = TextStyle(fontSize = 22.sp)
            )
            Text(
                text = label,
                style = TextStyle(
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFFFFFFF),
                    letterSpacing = 0.3.em
                )
            )
        }
    }
}

// ============================================================
// ACTIONS
// ============================================================

private val actionStartVoice = actionStartActivity(
    Intent().apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        setPackage("com.alpha1studio.gia")
        putExtra("action", "voice_start")
    }
)

private val actionCaptureScreen = actionStartActivity(
    Intent().apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        setPackage("com.alpha1studio.gia")
        putExtra("action", "screen_capture")
    }
)

private val actionOpenChat = actionStartActivity(
    Intent().apply {
        action = Intent.ACTION_MAIN
        addCategory(Intent.CATEGORY_LAUNCHER)
        setPackage("com.alpha1studio.gia")
        putExtra("action", "open_chat")
    }
)

// ============================================================
// RECEIVER
// ============================================================

class GIAWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = GIAAppWidget()
}
