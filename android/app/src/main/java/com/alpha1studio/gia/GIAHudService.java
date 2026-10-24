package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.text.InputType;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

/**
 * Persistent floating GIA chat.
 *
 * A small, draggable card drawn with TYPE_APPLICATION_OVERLAY. It survives
 * leaving GIA and opening another app. Messages are handled by the WebView
 * brain through GIAHudPlugin; this service owns only the overlay UI.
 */
public class GIAHudService extends Service {

    private static final String TAG = "GIAHudService";
    private static final String CHANNEL_ID = "GIAHudChannel";
    private static final int NOTIFICATION_ID = 7421;
    private static final String PREFS = "gia_hud_prefs";
    private static final String ACTION_START = "com.alpha1studio.gia.HUD_START";
    private static final String ACTION_SHOW = "com.alpha1studio.gia.HUD_SHOW";
    private static final String ACTION_HIDE = "com.alpha1studio.gia.HUD_HIDE";
    private static final String ACTION_STOP = "com.alpha1studio.gia.HUD_STOP";

    private static GIAHudService instance;

    private WindowManager windowManager;
    private WindowManager.LayoutParams params;
    private FrameLayout root;
    private LinearLayout card;
    private TextView bubble;
    private ScrollView messagesScroll;
    private LinearLayout messagesContainer;
    private TextView statusView;
    private TextView sendButton;
    private EditText input;
    private View hintView;
    private TextView currentAssistant;
    private String currentText = "";
    private boolean expanded = true;
    private boolean busy = false;
    private int cardWidth;
    private int cardHeight;
    private int screenWidth;
    private int screenHeight;
    private float downRawX;
    private float downRawY;
    private int startX;
    private int startY;
    private boolean dragging;

    private final Handler main = new Handler(Looper.getMainLooper());

    public static void start(Context context) {
        send(context, ACTION_START);
    }

    public static void show(Context context) {
        send(context, ACTION_SHOW);
    }

    /** Remove the overlay but keep the foreground service (and WebView) alive. */
    public static void hide(Context context) {
        send(context, ACTION_HIDE);
    }

    public static void stop(Context context) {
        context.stopService(new Intent(context, GIAHudService.class));
    }

    private static void send(Context context, String action) {
        Intent intent = new Intent(context, GIAHudService.class).setAction(action);
        if (instance != null) {
            context.startService(intent);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static boolean isVisible() {
        return instance != null && instance.root != null;
    }

    public static void appendMessage(String role, String text) {
        final GIAHudService service = instance;
        if (service == null || text == null) return;
        service.main.post(() -> service.addMessage(role, text));
    }

    public static void streamDelta(String delta, boolean done, String finalText) {
        final GIAHudService service = instance;
        if (service == null) return;
        service.main.post(() -> service.applyDelta(delta, done, finalText));
    }

    public static void setBusy(boolean value) {
        final GIAHudService service = instance;
        if (service == null) return;
        service.main.post(() -> service.setBusyInternal(value));
    }

    public static void clearMessages() {
        final GIAHudService service = instance;
        if (service == null) return;
        service.main.post(service::clearMessagesInternal);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannel();
        android.util.DisplayMetrics metrics = getResources().getDisplayMetrics();
        screenWidth = metrics.widthPixels;
        screenHeight = metrics.heightPixels;
        cardWidth = Math.min(dp(320), screenWidth - dp(24));
        cardHeight = Math.min(dp(480), (int) (screenHeight * 0.62f));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        startForeground(NOTIFICATION_ID, buildNotification());
        if (ACTION_HIDE.equals(action)) {
            hideOverlay();
            return START_STICKY;
        }
        if (ACTION_SHOW.equals(action) || action == null) {
            if (root == null) showOverlay();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        hideOverlay();
        instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void hideOverlay() {
        if (root != null && windowManager != null) {
            try {
                windowManager.removeView(root);
            } catch (Exception ignored) {
                // Window may already be gone after a process teardown.
            }
        }
        root = null;
        card = null;
        bubble = null;
        messagesScroll = null;
        messagesContainer = null;
        statusView = null;
        sendButton = null;
        input = null;
        hintView = null;
        currentAssistant = null;
        currentText = "";
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "GIA floating HUD",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Keeps the floating GIA chat available over other apps.");
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }

    private Notification buildNotification() {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("GIA floating HUD")
            .setContentText("Tap to open GIA")
            .setContentIntent(pending)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void showOverlay() {
        if (root != null) return;
        SharedPreferences prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        expanded = prefs.getBoolean("expanded", true);

        root = new FrameLayout(this);
        root.setClipChildren(false);

        card = buildCard();
        root.addView(card, new FrameLayout.LayoutParams(cardWidth, cardHeight));

        bubble = buildBubble();
        FrameLayout.LayoutParams bubbleParams = new FrameLayout.LayoutParams(dp(54), dp(40));
        root.addView(bubble, bubbleParams);

        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;
        params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = prefs.getInt("x", screenWidth - cardWidth - dp(12));
        params.y = prefs.getInt("y", screenHeight - cardHeight - dp(72));
        params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN;
        if (expanded) {
            params.flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
        }

        try {
            windowManager.addView(root, params);
        } catch (Exception e) {
            android.util.Log.w(TAG, "Could not add HUD overlay", e);
            root = null;
            stopSelf();
            return;
        }
        setExpanded(expanded, false);
        clampPosition();
        windowManager.updateViewLayout(root, params);
    }

    private LinearLayout buildCard() {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackground(roundRect(0xFF050505, dp(14), 0xFF242424));
        layout.setClipToPadding(false);
        layout.setPadding(0, 0, 0, 0);

        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(12), dp(8), dp(6), dp(8));
        header.setBackground(roundRect(0xFF0A0A0A, dp(14), 0xFF242424));

        TextView title = new TextView(this);
        title.setText("GIA");
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setTextColor(0xFFF5F5F5);
        title.setLetterSpacing(0.06f);
        header.addView(title);

        statusView = new TextView(this);
        statusView.setText("here");
        statusView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        statusView.setTextColor(0xFF8A8A8A);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        statusParams.leftMargin = dp(8);
        header.addView(statusView, statusParams);

        View spacer = new View(this);
        header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        TextView minimize = textButton("-");
        minimize.setContentDescription("Minimize GIA HUD");
        minimize.setOnClickListener(v -> setExpanded(false, true));
        header.addView(minimize);

        TextView power = textButton("x");
        power.setContentDescription("Turn off GIA HUD");
        power.setOnClickListener(v -> {
            GIAHudPlugin.notifyClosed();
            stop(this);
        });
        header.addView(power);

        header.setOnTouchListener(new DragTouchListener(false));
        layout.addView(header, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        messagesScroll = new ScrollView(this);
        messagesScroll.setFillViewport(true);
        messagesScroll.setVerticalScrollBarEnabled(false);
        messagesScroll.setPadding(dp(10), dp(6), dp(10), dp(4));
        messagesContainer = new LinearLayout(this);
        messagesContainer.setOrientation(LinearLayout.VERTICAL);
        messagesScroll.addView(messagesContainer, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        layout.addView(messagesScroll, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            0,
            1f
        ));

        LinearLayout inputRow = new LinearLayout(this);
        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        inputRow.setPadding(dp(8), dp(6), dp(8), dp(8));
        inputRow.setBackgroundColor(0xFF050505);

        input = new EditText(this);
        input.setHint("Message GIA");
        input.setHintTextColor(0xFF6E6E6E);
        input.setTextColor(0xFFF5F5F5);
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        input.setSingleLine(true);
        input.setImeOptions(EditorInfo.IME_ACTION_SEND);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setBackground(roundRect(0xFF101010, dp(10), 0xFF262626));
        input.setPadding(dp(10), dp(7), dp(10), dp(7));
        input.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendFromInput();
                return true;
            }
            return false;
        });
        inputRow.addView(input, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        sendButton = new TextView(this);
        sendButton.setText("Send");
        sendButton.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        sendButton.setTypeface(Typeface.DEFAULT_BOLD);
        sendButton.setTextColor(0xFFF5F5F5);
        sendButton.setGravity(Gravity.CENTER);
        sendButton.setPadding(dp(12), dp(8), dp(12), dp(8));
        sendButton.setBackground(roundRect(0xFF1A1A1A, dp(10), 0xFF303030));
        sendButton.setOnClickListener(v -> sendFromInput());
        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        sendParams.leftMargin = dp(6);
        inputRow.addView(sendButton, sendParams);

        layout.addView(inputRow, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));

        clearMessagesInternal();
        return layout;
    }

    private TextView buildBubble() {
        TextView view = new TextView(this);
        view.setText("GIA");
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setTextColor(0xFFF5F5F5);
        view.setGravity(Gravity.CENTER);
        view.setBackground(roundRect(0xFF0A0A0A, dp(12), 0xFF303030));
        view.setContentDescription("Open GIA floating chat");
        view.setOnTouchListener(new DragTouchListener(true));
        return view;
    }

    private TextView textButton(String label) {
        TextView view = new TextView(this);
        view.setText(label);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        view.setTextColor(0xFFB8B8B8);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(8), dp(2), dp(8), dp(2));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    private void sendFromInput() {
        if (input == null || busy) return;
        String text = input.getText().toString().trim();
        if (text.isEmpty()) return;
        input.setText("");
        addMessage("user", text);
        if (!GIAHudPlugin.isConnected()) {
            addMessage("assistant", "Open GIA to reconnect.");
            setBusyInternal(false);
            return;
        }
        setBusyInternal(true);
        GIAHudPlugin.dispatchFromHud(text);
    }

    private void addMessage(String role, String text) {
        if (messagesContainer == null || text == null || text.trim().isEmpty()) return;
        if (hintView != null) {
            messagesContainer.removeView(hintView);
            hintView = null;
        }
        createBubble(role, text);
        scrollToBottom();
    }

    private TextView createBubble(String role, String text) {
        boolean user = "user".equals(role);
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        view.setTextColor(0xFFF5F5F5);
        view.setLineSpacing(0, 1.08f);
        view.setPadding(dp(10), dp(7), dp(10), dp(7));
        view.setMaxWidth((int) (cardWidth * 0.86f));
        view.setBackground(roundRect(user ? 0xFF1A1A1A : 0xFF0D0D0D, dp(10), user ? 0xFF2A2A2A : 0xFF202020));

        FrameLayout wrapper = new FrameLayout(this);
        FrameLayout.LayoutParams bubbleParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        bubbleParams.gravity = user ? Gravity.END : Gravity.START;
        bubbleParams.setMargins(0, dp(3), 0, dp(3));
        wrapper.addView(view, bubbleParams);
        messagesContainer.addView(wrapper, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        return view;
    }

    private void clearMessagesInternal() {
        if (messagesContainer == null) return;
        messagesContainer.removeAllViews();
        currentAssistant = null;
        currentText = "";
        TextView hint = createBubble("assistant", "Ask GIA anything.");
        hint.setAlpha(0.62f);
        hintView = (View) hint.getParent();
    }

    private void applyDelta(String delta, boolean done, String finalText) {
        if (messagesContainer == null) return;
        if (hintView != null) {
            messagesContainer.removeView(hintView);
            hintView = null;
        }
        if (currentAssistant == null) {
            currentAssistant = createBubble("assistant", "");
            currentText = "";
        }
        if (delta != null && !delta.isEmpty()) {
            currentText += delta;
            currentAssistant.setText(currentText);
        }
        if (done) {
            if (finalText != null) {
                currentAssistant.setText(finalText);
            }
            currentAssistant = null;
            currentText = "";
            setBusyInternal(false);
        }
        scrollToBottom();
    }

    private void setBusyInternal(boolean value) {
        busy = value;
        if (statusView != null) statusView.setText(value ? "working" : "here");
        if (sendButton != null) {
            sendButton.setEnabled(!value);
            sendButton.setAlpha(value ? 0.45f : 1f);
        }
    }

    private void setExpanded(boolean value, boolean persist) {
        expanded = value;
        if (card != null) card.setVisibility(value ? View.VISIBLE : View.GONE);
        if (bubble != null) bubble.setVisibility(value ? View.GONE : View.VISIBLE);
        if (params != null) {
            if (value) {
                params.flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
                params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN
                    | WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE;
            } else {
                params.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL;
                params.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN;
                hideKeyboard();
            }
            clampPosition();
            if (root != null) windowManager.updateViewLayout(root, params);
        }
        if (persist) getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean("expanded", value).apply();
    }

    private void hideKeyboard() {
        if (input == null) return;
        InputMethodManager imm = (InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
        if (imm != null) imm.hideSoftInputFromWindow(input.getWindowToken(), 0);
    }

    private void clampPosition() {
        if (params == null) return;
        int currentWidth = expanded ? cardWidth : dp(54);
        int currentHeight = expanded ? cardHeight : dp(40);
        int maxX = Math.max(dp(8), screenWidth - currentWidth - dp(8));
        int maxY = Math.max(dp(8), screenHeight - currentHeight - dp(8));
        params.x = Math.max(dp(8), Math.min(params.x, maxX));
        params.y = Math.max(dp(8), Math.min(params.y, maxY));
    }

    private void savePosition() {
        if (params == null) return;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putInt("x", params.x)
            .putInt("y", params.y)
            .apply();
    }

    private void scrollToBottom() {
        if (messagesScroll == null) return;
        messagesScroll.post(() -> messagesScroll.fullScroll(View.FOCUS_DOWN));
    }

    private int dp(int value) {
        return (int) (value * getResources().getDisplayMetrics().density + 0.5f);
    }

    private GradientDrawable roundRect(int fill, int radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(radius);
        if (stroke != Color.TRANSPARENT) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private class DragTouchListener implements View.OnTouchListener {
        private final boolean expandOnTap;

        DragTouchListener(boolean expandOnTap) {
            this.expandOnTap = expandOnTap;
        }

        @Override
        public boolean onTouch(View view, MotionEvent event) {
            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    downRawX = event.getRawX();
                    downRawY = event.getRawY();
                    startX = params.x;
                    startY = params.y;
                    dragging = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    int dx = (int) (event.getRawX() - downRawX);
                    int dy = (int) (event.getRawY() - downRawY);
                    if (Math.abs(dx) > dp(4) || Math.abs(dy) > dp(4)) dragging = true;
                    if (dragging) {
                        params.x = startX + dx;
                        params.y = startY + dy;
                        clampPosition();
                        windowManager.updateViewLayout(root, params);
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    if (!dragging && expandOnTap && !expanded) {
                        setExpanded(true, true);
                    }
                    savePosition();
                    return true;
                default:
                    return false;
            }
        }
    }
}
