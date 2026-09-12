package com.alpha1studio.gia;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.annotation.SuppressLint;
import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LightingColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.drawable.GradientDrawable;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.util.DisplayMetrics;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupWindow;
import android.widget.TextView;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.GestureDetectorCompat;

import com.getcapacitor.JSObject;

import java.io.File;
import java.util.Locale;

/**
 * Floating GIA Screen Orb — a beautiful, pulsing, draggable orb overlay.
 * - Single tap → capture + analyze screen
 * - Double tap → cycle size (small / medium / large)
 * - Long press → options menu (Capture, Resize, Hide)
 * - Drag → reposition (snaps to edge)
 * - Enlarged touch slop for comfortable dragging
 */
public class GIAScreenOrbService extends Service {

    private static final String CHANNEL_ID = "GIAScreenOrbChannel";
    private static final int NOTIFICATION_ID = 1006;
    private static final int[] SIZES_DP = {44, 56, 72};
    private static final float GLOW_MULTIPLIER = 2.4f;

    // Orb assistant HUD + speech
    private static final String PREFS = "gia_orb_prefs";
    private static final String PREFS_SPEECH = "orb_speech_enabled";
    private static final String EVENT_ORBIT_ANALYZE = "orbitAnalyze";
    private static final String EVENT_ORBIT_VOICE = "orbitVoice";
    private static final int HUD_WIDTH_DP = 280;
    private static final int HUD_AUTO_HIDE_MS = 9000;
    private static final int HUD_TIMEOUT_MS = 30000;
    private static final int VOICE_MAX_MS = 15000;

    private static GIAScreenOrbService instance;
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    private WindowManager windowManager;
    private FrameLayout orbContainer;
    private View glowRing;
    private ImageView orbImage;
    private WindowManager.LayoutParams orbParams;

    // Orb assistant HUD overlay
    private View hudCard;
    private TextView hudTitle;
    private TextView hudBody;
    private ImageView hudImage;
    private WindowManager.LayoutParams hudParams;
    private boolean hudShowing = false;
    private boolean streamedSomething = false;
    private final Handler hudHandler = new Handler(Looper.getMainLooper());

    // Native speech
    private TextToSpeech tts;
    private boolean speechEnabled = true;

    // Orb voice capture (record in ANY app, transcribe on-device via Whisper)
    private MediaRecorder voiceRecorder;
    private File voiceFile;
    private boolean voiceRecording = false;
    private long voiceStartAt = 0;

    private GestureDetectorCompat gestureDetector;
    private int sizeIndex = 1; // starts at medium
    private int currentSizePx;
    private boolean isDragging = false;

    private ValueAnimator breatheAnim;
    private ValueAnimator glowAnim;
    private float breathePhase = 0f;

    // -------------------------------------------------------------------
    // Static API
    // -------------------------------------------------------------------

    public static void showOrb() {
        if (instance == null) return;
        mainHandler.post(() -> instance.showOrbInternal());
    }

    public static void hideOrb() {
        if (instance == null) return;
        mainHandler.post(() -> instance.hideOrbInternal());
    }

    public static boolean isShowing() {
        return instance != null && instance.orbContainer != null && instance.orbContainer.isAttachedToWindow();
    }

    public static void setSize(int sizeDp) {
        if (instance == null) return;
        mainHandler.post(() -> instance.setSizeInternal(sizeDp));
    }

    public static int getCurrentSize() {
        if (instance == null) return 56;
        return SIZES_DP[instance.sizeIndex];
    }

    // Orb assistant bridge — called from GIAScreenAgentPlugin

    public static void streamHudDelta(String delta, boolean done, String finalText) {
        final GIAScreenOrbService svc = instance;
        if (svc == null) return;
        mainHandler.post(() -> svc.applyHudDelta(delta, done, finalText));
    }

    public static void showHudImage(String path) {
        final GIAScreenOrbService svc = instance;
        if (svc == null) return;
        mainHandler.post(() -> svc.showHudImageInternal(path));
    }

    public static void setSpeechEnabled(boolean enabled) {
        final GIAScreenOrbService svc = instance;
        if (svc == null) return;
        mainHandler.post(() -> svc.setSpeechEnabledInternal(enabled));
    }

    public static boolean isSpeechEnabled() {
        return instance != null && instance.speechEnabled;
    }

    // -------------------------------------------------------------------
    // Service lifecycle
    // -------------------------------------------------------------------

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        speechEnabled = getSharedPreferences(PREFS, MODE_PRIVATE).getBoolean(PREFS_SPEECH, true);
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        showOrbInternal();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopAnimations();
        hudHandler.removeCallbacksAndMessages(null);
        if (voiceRecorder != null) {
            try { voiceRecorder.stop(); } catch (Exception ignored) {}
            try { voiceRecorder.release(); } catch (Exception ignored) {}
            voiceRecorder = null;
        }
        voiceRecording = false;
        hideHudInternal();
        if (tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
            tts.shutdown();
            tts = null;
        }
        hideOrbInternal();
        instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    // -------------------------------------------------------------------
    // Orb view creation
    // -------------------------------------------------------------------

    @SuppressLint("ClickableViewAccessibility")
    private void showOrbInternal() {
        if (orbContainer != null && orbContainer.isAttachedToWindow()) return;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        if (windowManager == null) return;

        currentSizePx = dpToPx(SIZES_DP[sizeIndex]);
        initOrbView();
        startAnimations();

        try {
            windowManager.addView(orbContainer, orbParams);
        } catch (Exception ignored) {}
    }

    private void hideOrbInternal() {
        stopAnimations();
        if (orbContainer != null && windowManager != null) {
            try {
                windowManager.removeView(orbContainer);
            } catch (Exception ignored) {}
            orbContainer = null;
            orbImage = null;
            glowRing = null;
        }
    }

    private void initOrbView() {
        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
        }

        int orbPx = currentSizePx;
        int glowPx = (int) (orbPx * GLOW_MULTIPLIER);

        orbParams = new WindowManager.LayoutParams(
                glowPx, glowPx,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                        | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT
        );
        orbParams.gravity = Gravity.TOP | Gravity.START;
        orbParams.x = dpToPx(12);
        orbParams.y = dpToPx(120);

        // Container
        orbContainer = new FrameLayout(this);
        orbContainer.setLayoutParams(new FrameLayout.LayoutParams(glowPx, glowPx));

        // Glow ring (outer pulsing aura)
        glowRing = new View(this);
        FrameLayout.LayoutParams glowLp = new FrameLayout.LayoutParams(glowPx, glowPx);
        glowLp.gravity = Gravity.CENTER;
        glowRing.setLayoutParams(glowLp);

        // Orb image — drawn programmatically with gradient + shine
        orbImage = new ImageView(this);
        int orbImageSize = orbPx;
        FrameLayout.LayoutParams orbLp = new FrameLayout.LayoutParams(orbImageSize, orbImageSize);
        orbLp.gravity = Gravity.CENTER;
        orbImage.setLayoutParams(orbLp);
        orbImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
        orbImage.setImageBitmap(createOrbBitmap(orbImageSize));
        orbImage.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        orbContainer.addView(glowRing);
        orbContainer.addView(orbImage);

        // Gesture detector
        gestureDetector = new GestureDetectorCompat(this, new OrbGestureListener());

        orbContainer.setOnTouchListener((v, event) -> {
            gestureDetector.onTouchEvent(event);

            switch (event.getActionMasked()) {
                case MotionEvent.ACTION_DOWN:
                    isDragging = false;
                    return true;

                case MotionEvent.ACTION_POINTER_DOWN: {
                    // Pinch-to-resize
                    if (event.getPointerCount() == 2) {
                        float x1 = event.getX(0), y1 = event.getY(0);
                        float x2 = event.getX(1), y2 = event.getY(1);
                        return true;
                    }
                    return true;
                }

                case MotionEvent.ACTION_MOVE: {
                    if (event.getPointerCount() == 2) {
                        // Pinch resize
                        float dx = event.getX(0) - event.getX(1);
                        float dy = event.getY(0) - event.getY(1);
                        float dist = (float) Math.sqrt(dx * dx + dy * dy);
                        handlePinch(dist);
                        return true;
                    }
                    if (event.getPointerCount() == 1) {
                        float dx = event.getRawX() - (orbParams.x + (float) glowPx / 2);
                        float dy = event.getRawY() - (orbParams.y + (float) glowPx / 2);
                        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
                            isDragging = true;
                            orbParams.x = (int) (event.getRawX() - glowPx / 2f);
                            orbParams.y = (int) (event.getRawY() - glowPx / 2f);
                            windowManager.updateViewLayout(orbContainer, orbParams);
                        }
                        return true;
                    }
                    return true;
                }

                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL: {
                    if (isDragging) {
                        snapToEdge();
                    }
                    return true;
                }
            }
            return false;
        });
    }

    // -------------------------------------------------------------------
    // Resize
    // -------------------------------------------------------------------

    private float lastPinchDist = 0;

    private void handlePinch(float dist) {
        if (lastPinchDist == 0) {
            lastPinchDist = dist;
            return;
        }
        float ratio = dist / lastPinchDist;
        if (ratio > 1.05f) {
            cycleSize(1);
            lastPinchDist = 0;
        } else if (ratio < 0.95f) {
            cycleSize(-1);
            lastPinchDist = 0;
        }
    }

    private void cycleSize(int direction) {
        int newIndex = Math.max(0, Math.min(SIZES_DP.length - 1, sizeIndex + direction));
        if (newIndex == sizeIndex) return;
        setSizeInternal(SIZES_DP[newIndex]);
    }

    private void setSizeInternal(int sizeDp) {
        if (windowManager == null || orbContainer == null) return;

        // Find closest size index
        int bestIdx = 1;
        int bestDiff = Integer.MAX_VALUE;
        for (int i = 0; i < SIZES_DP.length; i++) {
            int diff = Math.abs(SIZES_DP[i] - sizeDp);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }
        sizeIndex = bestIdx;
        currentSizePx = dpToPx(SIZES_DP[sizeIndex]);

        int glowPx = (int) (currentSizePx * GLOW_MULTIPLIER);

        // Update container size
        FrameLayout.LayoutParams containerLp = (FrameLayout.LayoutParams) orbContainer.getLayoutParams();
        containerLp.width = glowPx;
        containerLp.height = glowPx;
        orbContainer.setLayoutParams(containerLp);

        // Update glow ring size
        FrameLayout.LayoutParams glowLp = (FrameLayout.LayoutParams) glowRing.getLayoutParams();
        glowLp.width = glowPx;
        glowLp.height = glowPx;
        glowRing.setLayoutParams(glowLp);

        // Update orb image
        orbImage.setImageBitmap(createOrbBitmap(currentSizePx));
        FrameLayout.LayoutParams orbLp = (FrameLayout.LayoutParams) orbImage.getLayoutParams();
        orbLp.width = currentSizePx;
        orbLp.height = currentSizePx;
        orbImage.setLayoutParams(orbLp);

        // Update window layout params size
        orbParams.width = glowPx;
        orbParams.height = glowPx;
        windowManager.updateViewLayout(orbContainer, orbParams);
    }

    // -------------------------------------------------------------------
    // Animations
    // -------------------------------------------------------------------

    private void startAnimations() {
        stopAnimations();

        // Breathe animation — gentle scale oscillation
        breatheAnim = ValueAnimator.ofFloat(0f, 1f);
        breatheAnim.setDuration(2800);
        breatheAnim.setRepeatCount(ValueAnimator.INFINITE);
        breatheAnim.setRepeatMode(ValueAnimator.REVERSE);
        breatheAnim.setInterpolator(new AccelerateDecelerateInterpolator());
        breatheAnim.addUpdateListener(anim -> {
            breathePhase = (float) anim.getAnimatedValue();
            float scale = 1f + 0.06f * breathePhase;
            if (orbImage != null) {
                orbImage.setScaleX(scale);
                orbImage.setScaleY(scale);
            }
            // Glow ring opacity pulses out of phase
            if (glowRing != null) {
                float glowAlpha = 0.3f + 0.25f * (1f - breathePhase);
                glowRing.setAlpha(glowAlpha);
                float glowScale = 1f + 0.15f * breathePhase;
                glowRing.setScaleX(glowScale);
                glowRing.setScaleY(glowScale);
            }
        });
        breatheAnim.start();

        // Glow color animation — slow hue shift
        glowAnim = ValueAnimator.ofFloat(0f, 360f);
        glowAnim.setDuration(12000);
        glowAnim.setRepeatCount(ValueAnimator.INFINITE);
        glowAnim.setRepeatMode(ValueAnimator.RESTART);
        glowAnim.setInterpolator(new AccelerateDecelerateInterpolator());
        glowAnim.addUpdateListener(anim -> {
            float hue = (float) anim.getAnimatedValue();
            updateGlowColor(hue);
        });
        glowAnim.start();
    }

    private void stopAnimations() {
        if (breatheAnim != null) {
            breatheAnim.cancel();
            breatheAnim = null;
        }
        if (glowAnim != null) {
            glowAnim.cancel();
            glowAnim = null;
        }
    }

    private void updateGlowColor(float hue) {
        if (glowRing == null) return;
        int color = Color.HSVToColor(new float[]{hue, 0.7f, 0.9f});
        int colorTransparent = Color.HSVToColor(new float[]{hue, 0.7f, 0.9f});
        int colorAlpha = Color.argb(60, Color.red(colorTransparent), Color.green(colorTransparent), Color.blue(colorTransparent));

        GradientDrawable glow = new GradientDrawable();
        glow.setShape(GradientDrawable.OVAL);
        glow.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        glow.setGradientRadius(currentSizePx * GLOW_MULTIPLIER / 2f);
        glow.setColors(new int[]{Color.argb(20, Color.red(color), Color.green(color), Color.blue(color)), Color.TRANSPARENT});
        glowRing.setBackground(glow);
    }

    // -------------------------------------------------------------------
    // Orb bitmap — beautiful gradient + shine + G
    // -------------------------------------------------------------------

    private Bitmap createOrbBitmap(int size) {
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        float cx = size / 2f;
        float cy = size / 2f;
        float radius = size / 2f;

        // Radial gradient background — purple to indigo to violet
        int[] colors = {
                0xFFc084fc, // light purple
                0xFFa855f7, // purple
                0xFF7c3aed, // violet
                0xFF6d28d9, // deep violet
        };
        float[] stops = {0f, 0.4f, 0.7f, 1f};
        RadialGradient gradient = new RadialGradient(cx, cy, radius, colors, stops, Shader.TileMode.CLAMP);
        Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        bgPaint.setShader(gradient);
        canvas.drawCircle(cx, cy, radius, bgPaint);

        // Shine highlight (top-left light spot)
        Paint shinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        RadialGradient shineGrad = new RadialGradient(
                cx - radius * 0.3f, cy - radius * 0.3f, radius * 0.6f,
                new int[]{0x55FFFFFF, 0x00FFFFFF},
                new float[]{0f, 1f},
                Shader.TileMode.CLAMP
        );
        shinePaint.setShader(shineGrad);
        canvas.drawCircle(cx, cy, radius, shinePaint);

        // Inner glow rim light
        Paint rimPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        rimPaint.setStyle(Paint.Style.STROKE);
        rimPaint.setStrokeWidth(size * 0.04f);
        rimPaint.setColor(0x40FFFFFF);
        canvas.drawCircle(cx, cy, radius - size * 0.04f, rimPaint);

        // "G" letter — minimalist, modern
        Paint letterPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        letterPaint.setColor(Color.WHITE);
        letterPaint.setStyle(Paint.Style.STROKE);
        letterPaint.setStrokeWidth(size * 0.09f);
        letterPaint.setStrokeCap(Paint.Cap.ROUND);
        letterPaint.setStrokeJoin(Paint.Join.ROUND);
        letterPaint.setShadowLayer(size * 0.08f, 0, size * 0.04f, 0x33000000);

        float gR = radius * 0.34f;
        float gCx = cx;
        float gCy = cy + size * 0.02f;
        // Draw arcs for a stylized G
        canvas.drawArc(gCx - gR, gCy - gR, gCx + gR, gCy + gR, -90, 270, false, letterPaint);
        // G crossbar
        canvas.drawLine(gCx, gCy - gR * 0.3f, gCx + gR * 0.7f, gCy - gR * 0.3f, letterPaint);

        return bitmap;
    }

    // -------------------------------------------------------------------
    // Gesture listener
    // -------------------------------------------------------------------

    private class OrbGestureListener extends GestureDetector.SimpleOnGestureListener {
        @Override
        public boolean onSingleTapConfirmed(MotionEvent e) {
            onOrbTap();
            return true;
        }

        @Override
        public boolean onDoubleTap(MotionEvent e) {
            cycleSize(1);
            return true;
        }

        @Override
        public void onLongPress(MotionEvent e) {
            showPopupMenu();
        }
    }

    // -------------------------------------------------------------------
    // Actions
    // -------------------------------------------------------------------

    private void onOrbTap() {
        // While listening, a single tap stops recording and hands the clip to the brain.
        if (voiceRecording) {
            stopOrbVoice();
            return;
        }
        animateTapBurst();
        captureAndAnalyze();
    }

    private void animateTapBurst() {
        if (orbImage == null) return;
        orbImage.animate()
                .scaleX(1.25f).scaleY(1.25f)
                .setDuration(120)
                .withEndAction(() -> {
                    if (orbImage != null) {
                        orbImage.animate()
                                .scaleX(1f + 0.06f * breathePhase)
                                .scaleY(1f + 0.06f * breathePhase)
                                .setDuration(200)
                                .start();
                    }
                })
                .start();
    }

    /**
     * Capture the current screen IN PLACE (no app launch) and hand it to the
     * JS brain (OrbAssistant) for vision + provider analysis, streaming the
     * response back into the floating HUD and speaking it with native TTS.
     */
    private void captureAndAnalyze() {
        hudHandler.removeCallbacksAndMessages(null);
        streamedSomething = false;

        if (!GIAAccessibilityService.isRunning()) {
            showHudMessage("GIA needs Accessibility enabled to see your screen. Tap to open Settings → Accessibility → GIA Screen Agent.");
            Intent settings = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { startActivity(settings); } catch (Exception ignored) {}
            return;
        }

        String path = GIAAccessibilityService.captureScreen();
        if (path == null) {
            showHudMessage("Couldn't capture the screen. Try again.");
            return;
        }

        // Emit a cache-relative path so JS can read it via @capacitor/filesystem.
        String relative = toCacheRelative(path);
        showHudMessage("Looking at your screen…");

        JSObject data = new JSObject();
        data.put("path", relative);
        data.put("timestamp", System.currentTimeMillis());
        GIAScreenAgentPlugin.emit(EVENT_ORBIT_ANALYZE, data);

        // Fallback: if the JS brain never responds (keep-alive off / no provider),
        // tell the user instead of leaving the HUD up forever.
        hudHandler.postDelayed(() -> {
            if (hudShowing) {
                showHudMessage("No response from GIA. Open the app once, enable Keep-alive (Developer settings) and connect a provider — then the orb works on its own.");
            }
        }, HUD_TIMEOUT_MS);
    }

    private String toCacheRelative(String absolutePath) {
        try {
            String cache = getCacheDir().getAbsolutePath();
            if (absolutePath.startsWith(cache)) {
                return absolutePath.substring(cache.length() + 1);
            }
        } catch (Exception ignored) {}
        return absolutePath;
    }

    private void showPopupMenu() {
        if (orbContainer == null || !orbContainer.isAttachedToWindow()) return;

        LayoutInflater inflater = LayoutInflater.from(this);
        View popupView = inflater.inflate(
                getResources().getIdentifier("screen_orb_popup", "layout", getPackageName()),
                null
        );
        if (popupView == null) return;

        PopupWindow popup = new PopupWindow(
                popupView,
                dpToPx(200),
                WindowManager.LayoutParams.WRAP_CONTENT,
                true
        );
        popup.setElevation(24f);
        popup.setBackgroundDrawable(new GradientDrawable() {{
            setShape(GradientDrawable.RECTANGLE);
            setColor(0xEE1a1a2e);
            setCornerRadius(dpToPx(16));
        }});
        popup.setOutsideTouchable(true);

        int[] location = new int[2];
        orbContainer.getLocationOnScreen(location);
        int orbY = location[1];
        int popupX = orbParams.x < dpToPx(100) ? orbParams.x + dpToPx(70) : orbParams.x - dpToPx(200);
        int popupY = orbY - dpToPx(10);

        try {
            popup.showAtLocation(orbContainer, Gravity.NO_GRAVITY, popupX, popupY);
        } catch (Exception ignored) {}

        // Wire up buttons
        String[] actions = {
            "Analyze Screen",
            voiceRecording ? "Stop" : "Listen",
            "Speech: " + (speechEnabled ? "ON" : "OFF"),
            "Resize (" + SIZES_DP[sizeIndex] + "dp)",
            "Hide Orb"
        };
        int[] colors = {
            0xFFFFFFFF,
            0xFF4ade80,
            speechEnabled ? 0xFF4ade80 : 0xFF94a3b8,
            0xFFa855f7,
            0xFFf87171
        };

        if (popupView instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) popupView;
            for (int i = 0; i < Math.min(group.getChildCount(), actions.length); i++) {
                View child = group.getChildAt(i);
                if (child instanceof TextView) {
                    ((TextView) child).setText(actions[i]);
                    ((TextView) child).setTextColor(colors[i]);
                    final int idx = i;
                    child.setOnClickListener(v -> {
                        popup.dismiss();
                        handlePopupAction(idx);
                    });
                }
            }
        }
    }

    private void handlePopupAction(int index) {
        switch (index) {
            case 0: captureAndAnalyze(); break;
            case 1:
                if (voiceRecording) stopOrbVoice();
                else startOrbVoice();
                break;
            case 2:
                setSpeechEnabledInternal(!speechEnabled);
                if (orbContainer != null) showPopupMenu();
                break;
            case 3:
                cycleSize(1);
                if (orbContainer != null) showPopupMenu();
                break;
            case 4:
                hideOrbInternal();
                stopSelf();
                break;
        }
    }

    // -------------------------------------------------------------------
    // Orb voice capture — record from ANY app, transcribe on-device
    // -------------------------------------------------------------------

    private void startOrbVoice() {
        hudHandler.removeCallbacksAndMessages(null);
        streamedSomething = false;

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            showHudMessage("GIA needs Microphone permission to hear you. Opening GIA app settings — enable Microphone, then try Listen again.");
            openPermissionSettings();
            return;
        }

        try {
            File dir = new File(getCacheDir(), "voice");
            if (!dir.exists() && !dir.mkdirs()) {
                showHudMessage("Couldn't create a voice folder. Try again.");
                return;
            }
            voiceFile = new File(dir, "orb_capture_" + System.currentTimeMillis() + ".m4a");

            voiceRecorder = new MediaRecorder();
            voiceRecorder.setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION);
            voiceRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            voiceRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            voiceRecorder.setAudioSamplingRate(16000);
            voiceRecorder.setAudioEncodingBitRate(64000);
            voiceRecorder.setOutputFile(voiceFile.getAbsolutePath());
            voiceRecorder.prepare();
            voiceRecorder.start();

            voiceRecording = true;
            voiceStartAt = System.currentTimeMillis();
            showHudMessage("Listening… say something, then tap the orb to finish");

            hudHandler.postDelayed(() -> {
                if (voiceRecording) stopOrbVoice();
            }, VOICE_MAX_MS);
        } catch (Exception e) {
            voiceRecording = false;
            if (voiceRecorder != null) {
                try { voiceRecorder.release(); } catch (Exception ignored) {}
                voiceRecorder = null;
            }
            showHudMessage("Mic couldn't start (" + e.getClass().getSimpleName() + "). Try again.");
        }
    }

    private void stopOrbVoice() {
        hudHandler.removeCallbacksAndMessages(null);
        MediaRecorder rec = voiceRecorder;
        voiceRecorder = null;
        voiceRecording = false;
        if (rec == null) return;

        long durationMs = System.currentTimeMillis() - voiceStartAt;

        try { rec.stop(); } catch (Exception ignored) {} // too-short clips throw — still readable
        try { rec.release(); } catch (Exception ignored) {}

        if (voiceFile == null || !voiceFile.exists()) {
            showHudMessage("Hmm, I didn't catch that. Try again.");
            return;
        }

        showHudMessage("Hearing you…");

        JSObject data = new JSObject();
        data.put("path", toCacheRelative(voiceFile.getAbsolutePath()));
        data.put("timestamp", System.currentTimeMillis());
        data.put("durationMs", durationMs);
        GIAScreenAgentPlugin.emit(EVENT_ORBIT_VOICE, data);

        // Fallback: no JS response (keep-alive off / Whisper not downloaded).
        hudHandler.postDelayed(() -> {
            if (hudShowing) {
                showHudMessage("No response from GIA. Open the app once, enable Keep-alive (Developer settings), and download Whisper or enable the Cloud STT fallback (Settings → Voice) — then the orb can hear you.");
            }
        }, HUD_TIMEOUT_MS);
    }

    private void openPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", getPackageName(), null));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
            } catch (Exception ignored) {}
        }
    }

    // -------------------------------------------------------------------
    // Orb assistant HUD — floating response card rendered beside the orb
    // -------------------------------------------------------------------

    private void showHudMessage(String message) {
        ensureHud();
        if (hudCard == null || hudBody == null) return;
        hudBody.setText(message);
        streamedSomething = false;
        setHudVisible(true);
        repositionHud();
    }

    private void applyHudDelta(String delta, boolean done, String finalText) {
        ensureHud();
        if (hudCard == null || hudBody == null) return;

        if (!done) {
            if (!streamedSomething) {
                String current = hudBody.getText().toString();
                if (current.isEmpty()
                        || current.startsWith("Looking") // "Looking at your screen…"
                        || current.startsWith("Listening") // "Listening… say something…"
                        || current.startsWith("Hearing")) { // "Hearing you…"
                    hudBody.setText("");
                }
            }
            if (delta != null && !delta.isEmpty()) {
                hudBody.append(delta);
                streamedSomething = true;
            }
        } else {
            if (finalText != null && !finalText.isEmpty()) {
                if (!streamedSomething || hudBody.length() == 0) {
                    hudBody.setText(finalText);
                }
                speak(finalText);
            } else if (delta != null && !delta.isEmpty()) {
                hudBody.append(delta);
            }
            setHudVisible(true);
            hudHandler.removeCallbacksAndMessages(null);
            hudHandler.postDelayed(this::hideHudInternal, HUD_AUTO_HIDE_MS);
        }
        repositionHud();
    }

    private void ensureHud() {
        if (hudCard != null) return;

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dpToPx(16), dpToPx(12), dpToPx(16), dpToPx(12));

        GradientDrawable bg = new GradientDrawable();
        bg.setShape(GradientDrawable.RECTANGLE);
        bg.setColor(0xF21A1A2E);
        bg.setCornerRadius(dpToPx(16));
        root.setBackground(bg);
        root.setElevation(dpToPx(18));

        hudTitle = new TextView(this);
        hudTitle.setText("✦ GIA Orb");
        hudTitle.setTextColor(0xFFa855f7);
        hudTitle.setTextSize(12);
        hudTitle.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        root.addView(hudTitle, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        hudImage = new ImageView(this);
        hudImage.setVisibility(View.GONE);
        hudImage.setScaleType(ImageView.ScaleType.FIT_CENTER);
        hudImage.setAdjustViewBounds(true);
        hudImage.setMaxHeight(dpToPx(220));
        LinearLayout.LayoutParams imgLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        imgLp.topMargin = dpToPx(6);
        root.addView(hudImage, imgLp);

        hudBody = new TextView(this);
        hudBody.setTextColor(0xFFF0F0FF);
        hudBody.setTextSize(14);
        hudBody.setLineSpacing(0f, 1.1f);
        hudBody.setMaxLines(14);
        hudBody.setEllipsize(android.text.TextUtils.TruncateAt.END);
        root.addView(hudBody, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        root.setOnClickListener(v -> hideHudInternal());

        hudCard = root;
        hudParams = new WindowManager.LayoutParams(
            dpToPx(HUD_WIDTH_DP),
            WindowManager.LayoutParams.WRAP_CONTENT,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_SYSTEM_ALERT,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
        hudParams.gravity = Gravity.TOP | Gravity.START;
    }

    private void setHudVisible(boolean visible) {
        if (windowManager == null || hudCard == null) return;
        try {
            if (visible && !hudShowing) {
                windowManager.addView(hudCard, hudParams);
                hudCard.setAlpha(0f);
                hudCard.animate().alpha(1f).setDuration(180).start();
                hudShowing = true;
            }
        } catch (Exception ignored) {}
    }

    private void repositionHud() {
        ensureHud();
        if (windowManager == null || orbContainer == null || orbParams == null) return;

        setHudVisible(true);
        if (!hudShowing) return;

        try {
            hudCard.measure(
                View.MeasureSpec.makeMeasureSpec(hudParams.width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED)
            );
            int height = hudCard.getMeasuredHeight();
            int screenW = getResources().getDisplayMetrics().widthPixels;
            int screenH = getResources().getDisplayMetrics().heightPixels;
            int orbX = orbParams.x;
            int orbY = orbParams.y;
            int orbW = orbParams.width;
            int orbH = orbParams.height;

            int x;
            if (orbX - hudParams.width - dpToPx(8) >= dpToPx(4)) {
                x = orbX - hudParams.width - dpToPx(8);
            } else if (orbX + orbW + dpToPx(8) + hudParams.width <= screenW - dpToPx(4)) {
                x = orbX + orbW + dpToPx(8);
            } else {
                x = Math.max(dpToPx(4), Math.min(orbX, screenW - hudParams.width - dpToPx(4)));
            }
            int y = Math.max(dpToPx(4), Math.min(Math.max(orbY - height - dpToPx(8), dpToPx(4)), screenH - height - dpToPx(4)));
            hudParams.x = x;
            hudParams.y = y;
            windowManager.updateViewLayout(hudCard, hudParams);
        } catch (Exception ignored) {}
    }

    private void hideHudInternal() {
        hudHandler.removeCallbacksAndMessages(null);
        if (hudCard != null && windowManager != null && hudShowing) {
            try { windowManager.removeView(hudCard); } catch (Exception ignored) {}
            hudShowing = false;
        }
        streamedSomething = false;
    }

    private void showHudImageInternal(String path) {
        ensureHud();
        if (hudCard == null || hudImage == null) return;
        Bitmap bmp = BitmapFactory.decodeFile(path);
        if (bmp == null) return;
        hudImage.setImageBitmap(bmp);
        hudImage.setVisibility(View.VISIBLE);
        setHudVisible(true);
        repositionHud();
        hudHandler.removeCallbacksAndMessages(null);
        hudHandler.postDelayed(this::hideHudInternal, HUD_AUTO_HIDE_MS + 2000);
    }

    // -------------------------------------------------------------------
    // Native orb speech (Android TextToSpeech)
    // -------------------------------------------------------------------

    private void setSpeechEnabledInternal(boolean enabled) {
        speechEnabled = enabled;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putBoolean(PREFS_SPEECH, enabled).apply();
        if (!enabled && tts != null) {
            try { tts.stop(); } catch (Exception ignored) {}
        }
    }

    private void ensureTts() {
        if (tts == null) {
            tts = new TextToSpeech(this, status -> {
                if (status == TextToSpeech.SUCCESS) {
                    try {
                        tts.setLanguage(Locale.getDefault());
                        tts.setSpeechRate(1.05f);
                    } catch (Exception ignored) {}
                }
            });
        }
    }

    private void speak(String text) {
        if (text == null || text.isEmpty() || !speechEnabled) return;
        ensureTts();
        try {
            String clean = text
                .replaceAll("[*_`#>-]", "")
                .replaceAll("\\s+", " ")
                .trim();
            if (clean.length() > 280) clean = clean.substring(0, 280);
            tts.stop();
            tts.speak(clean, TextToSpeech.QUEUE_FLUSH, null, "orb_" + System.currentTimeMillis());
        } catch (Exception ignored) {}
    }

    // -------------------------------------------------------------------
    // Edge snap
    // -------------------------------------------------------------------

    private void snapToEdge() {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        int screenWidth = metrics.widthPixels;
        int glowPx = orbParams.width;

        int midpoint = orbParams.x + glowPx / 2;
        if (midpoint < screenWidth / 2) {
            orbParams.x = dpToPx(-6);
        } else {
            orbParams.x = screenWidth - glowPx + dpToPx(6);
        }

        orbParams.y = Math.max(dpToPx(40), Math.min(orbParams.y, metrics.heightPixels - glowPx - dpToPx(40)));

        try {
            windowManager.updateViewLayout(orbContainer, orbParams);
        } catch (Exception ignored) {}
    }

    // -------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------

    private int dpToPx(int dp) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        return Math.round(dp * (metrics.densityDpi / 160f));
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "GIA Screen Orb",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Floating GIA orb for instant screen capture");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("GIA Orb")
                .setContentText("Tap to capture screen")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder.setChannelId(CHANNEL_ID);
        }

        return builder.build();
    }
}
