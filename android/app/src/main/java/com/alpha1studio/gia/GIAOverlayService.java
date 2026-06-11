package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Base64;
import android.view.Display;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

public class GIAOverlayService extends Service {

    private static final String CHANNEL_ID = "GIAOverlayChannel";
    private static final int NOTIFICATION_ID = 1002;

    private static GIAOverlayService instance;
    private static GIAOverlayPlugin pluginRef;

    private WindowManager windowManager;
    private FrameLayout overlayView;
    private ImageView capturePreview;
    private View controlsView;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int displayWidth;
    private int displayHeight;
    private int densityDpi;

    private Path drawPath = new Path();
    private Paint drawPaint = new Paint();
    private float touchX, touchY;
    private boolean isDrawing = false;
    private boolean overlayVisible = false;
    private boolean captureReady = false;
    private String pendingQuery = "";

    private int resultCode;
    private Intent data;

    public static void setPluginRef(GIAOverlayPlugin plugin) {
        pluginRef = plugin;
    }

    public static void startOverlay(Context context, int resultCode, Intent data, GIAOverlayPlugin plugin) {
        setPluginRef(plugin);

        Intent intent = new Intent(context, GIAOverlayService.class);
        intent.putExtra("resultCode", resultCode);
        intent.putExtra("data", data);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    public static void hideOverlay() {
        if (instance != null) {
            instance.stopSelf();
        }
    }

    public static boolean isOverlayVisible() {
        return instance != null && instance.overlayVisible;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();

        drawPaint.setColor(0xCCa855f7);
        drawPaint.setStyle(Paint.Style.STROKE);
        drawPaint.setStrokeWidth(6f);
        drawPaint.setAntiAlias(true);
        drawPaint.setStrokeCap(Paint.Cap.ROUND);
        drawPaint.setStrokeJoin(Paint.Join.ROUND);
        drawPaint.setShadowLayer(12f, 0f, 0f, Color.argb(120, 168, 85, 247));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            resultCode = intent.getIntExtra("resultCode", -1);
            data = intent.getParcelableExtra("data");
        }

        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);

        if (resultCode != -1 && data != null) {
            initMediaProjection();
        }

        showOverlay();
        overlayVisible = true;
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        overlayVisible = false;
        hideOverlayView();
        releaseMediaProjection();
        instance = null;
        pluginRef = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Circle to Search",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("GIA is ready to capture your screen");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification() {
        Intent tapIntent = new Intent(this, MainActivity.class);
        tapIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("GIA Circle to Search")
            .setContentText("Draw a circle to search")
            .setSmallIcon(android.R.drawable.ic_menu_crop)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setSilent(true)
            .build();
    }

    private void initMediaProjection() {
        MediaProjectionManager mpm = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        if (mpm == null) return;

        mediaProjection = mpm.getMediaProjection(resultCode, data);
        if (mediaProjection == null) return;

        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        Display display = wm.getDefaultDisplay();
        Point size = new Point();
        display.getRealSize(size);
        displayWidth = size.x;
        displayHeight = size.y;
        densityDpi = getResources().getDisplayMetrics().densityDpi;
        captureReady = true;
    }

    private void showOverlay() {
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
        }

        int flags = WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
            | WindowManager.LayoutParams.FLAG_FULLSCREEN
            | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH
            | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            layoutFlag,
            flags,
            PixelFormat.TRANSLUCENT
        );

        overlayView = new FrameLayout(this);

        DrawingView drawingView = new DrawingView(this);
        overlayView.addView(drawingView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        controlsView = createControlsView();
        overlayView.addView(controlsView);

        capturePreview = new ImageView(this);
        capturePreview.setVisibility(View.GONE);
        overlayView.addView(capturePreview, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        ));

        windowManager.addView(overlayView, params);

        // Show keyboard after a brief delay
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            windowManager.updateViewLayout(overlayView, params);
            EditText input = overlayView.findViewWithTag("query_input");
            if (input != null) {
                input.requestFocus();
                InputMethodManager imm = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
            }
        }, 300);
    }

    private View createControlsView() {
        FrameLayout container = new FrameLayout(this);

        // Hint text at top
        TextView hint = new TextView(this);
        hint.setText("Circle anything on screen, then ask");
        hint.setTextColor(Color.argb(180, 255, 255, 255));
        hint.setTextSize(13f);
        hint.setGravity(Gravity.CENTER);
        hint.setPadding(40, 20, 40, 20);

        FrameLayout.LayoutParams hintParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        hintParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        hintParams.topMargin = 80;
        container.addView(hint, hintParams);

        // Cancel button (X) top-left
        View cancelBtn = new View(this) {
            {
                setBackgroundDrawable(null);
            }

            @Override
            protected void onDraw(Canvas canvas) {
                super.onDraw(canvas);
                Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
                p.setColor(0xCC333333);
                canvas.drawCircle(getWidth() / 2f, getHeight() / 2f, getWidth() / 2f, p);
                p.setColor(Color.WHITE);
                p.setStrokeWidth(4f);
                float cx = getWidth() / 2f, cy = getHeight() / 2f;
                float s = getWidth() * 0.3f;
                canvas.drawLine(cx - s, cy - s, cx + s, cy + s, p);
                canvas.drawLine(cx + s, cy - s, cx - s, cy + s, p);
            }
        };
        cancelBtn.setOnClickListener(v -> {
            if (pluginRef != null) pluginRef.onOverlayCancelled();
            stopSelf();
        });

        FrameLayout.LayoutParams cancelParams = new FrameLayout.LayoutParams(56, 56);
        cancelParams.gravity = Gravity.TOP | Gravity.START;
        cancelParams.topMargin = 60;
        cancelParams.leftMargin = 20;
        container.addView(cancelBtn, cancelParams);

        // Bottom input bar
        LinearLayout bottomBar = new LinearLayout(this);
        bottomBar.setOrientation(LinearLayout.HORIZONTAL);
        bottomBar.setGravity(Gravity.CENTER_VERTICAL);
        bottomBar.setPadding(16, 12, 16, 12);
        bottomBar.setBackgroundColor(Color.argb(220, 25, 25, 35));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            bottomBar.setElevation(12f);
        }

        EditText queryInput = new EditText(this);
        queryInput.setTag("query_input");
        queryInput.setHint("Ask about anything on screen…");
        queryInput.setHintTextColor(Color.argb(120, 255, 255, 255));
        queryInput.setTextColor(Color.WHITE);
        queryInput.setTextSize(15f);
        queryInput.setBackground(null);
        queryInput.setPadding(12, 10, 12, 10);
        queryInput.setSingleLine(true);
        queryInput.setImeOptions(EditorInfo.IME_ACTION_SEND);

        queryInput.setOnEditorActionListener((v, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_SEND) {
                sendQuery();
                return true;
            }
            return false;
        });

        queryInput.addTextChangedListener(new android.text.TextWatcher() {
            @Override public void beforeTextChanged(CharSequence s, int start, int count, int after) {}
            @Override public void afterTextChanged(android.text.Editable s) {}
            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                pendingQuery = s.toString();
            }
        });

        LinearLayout.LayoutParams inputParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f
        );
        bottomBar.addView(queryInput, inputParams);

        // Send button
        android.widget.ImageButton sendBtn = new android.widget.ImageButton(this);
        sendBtn.setTag("send_btn");
        sendBtn.setContentDescription("Send");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            android.graphics.drawable.GradientDrawable sendBg = new android.graphics.drawable.GradientDrawable();
            sendBg.setColor(Color.argb(220, 168, 85, 247));
            sendBg.setCornerRadius(24f);
            sendBtn.setBackground(sendBg);
            sendBtn.setElevation(4f);
        } else {
            sendBtn.setBackgroundColor(Color.argb(220, 168, 85, 247));
        }
        sendBtn.setPadding(14, 14, 14, 14);

        // Draw paper plane icon
        android.graphics.drawable.Drawable sendIcon = new android.graphics.drawable.Drawable() {
            @Override
            public void draw(Canvas canvas) {
                Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
                p.setColor(Color.WHITE);
                p.setStrokeWidth(2.5f);
                p.setStyle(Paint.Style.FILL);
                float cx = getBounds().centerX(), cy = getBounds().centerY();
                float s = Math.min(getBounds().width(), getBounds().height()) * 0.35f;
                Path path = new Path();
                path.moveTo(cx - s * 0.8f, cy + s * 0.6f);
                path.lineTo(cx, cy - s * 0.8f);
                path.lineTo(cx + s * 0.8f, cy + s * 0.6f);
                path.lineTo(cx, cy + s * 0.2f);
                path.close();
                canvas.drawPath(path, p);
            }

            @Override
            public void setAlpha(int alpha) {}
            @Override
            public void setColorFilter(android.graphics.ColorFilter cf) {}
            @Override
            public int getOpacity() { return android.graphics.PixelFormat.TRANSLUCENT; }
        };
        sendIcon.setBounds(0, 0, 48, 48);
        sendBtn.setImageDrawable(sendIcon);
        sendBtn.setOnClickListener(v -> sendQuery());

        LinearLayout.LayoutParams sendParams = new LinearLayout.LayoutParams(
            48, 48
        );
        sendParams.leftMargin = 8;
        bottomBar.addView(sendBtn, sendParams);

        FrameLayout.LayoutParams barParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        barParams.gravity = Gravity.BOTTOM;
        barParams.bottomMargin = 24;
        barParams.leftMargin = 16;
        barParams.rightMargin = 16;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            bottomBar.setClipToOutline(true);
            android.graphics.drawable.GradientDrawable shape = new android.graphics.drawable.GradientDrawable();
            shape.setCornerRadius(28f);
            shape.setColor(Color.argb(220, 25, 25, 35));
            bottomBar.setBackground(shape);
            bottomBar.setElevation(8f);
        }

        container.addView(bottomBar, barParams);

        return container;
    }

    private void sendQuery() {
        String text = pendingQuery.trim();
        pendingQuery = "";
        if (!drawPath.isEmpty()) {
            captureAndCrop(text);
        } else {
            if (text.isEmpty()) {
                if (pluginRef != null) pluginRef.onOverlayCancelled();
                stopSelf();
                return;
            }
            if (pluginRef != null) pluginRef.onQuerySubmitted(text);
            stopSelf();
        }
    }

    private class DrawingView extends View {
        private Paint bgPaint = new Paint();
        private Paint clearPaint = new Paint();

        public DrawingView(Context context) {
            super(context);
            bgPaint.setColor(0x99000000);

            clearPaint.setColor(0x00000000);
            clearPaint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.CLEAR));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);

            canvas.drawColor(0x88000000);

            canvas.drawPath(drawPath, drawPaint);
        }

        @Override
        public boolean onTouchEvent(MotionEvent event) {
            float x = event.getX();
            float y = event.getY();

            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    drawPath.reset();
                    drawPath.moveTo(x, y);
                    touchX = x;
                    touchY = y;
                    isDrawing = false;
                    invalidate();
                    return true;
                case MotionEvent.ACTION_MOVE:
                    float dx = Math.abs(x - touchX);
                    float dy = Math.abs(y - touchY);
                    if (isDrawing || dx > 8 || dy > 8) {
                        isDrawing = true;
                        drawPath.quadTo(touchX, touchY, (x + touchX) / 2, (y + touchY) / 2);
                        touchX = x;
                        touchY = y;
                        invalidate();
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (isDrawing) {
                        drawPath.lineTo(x, y);
                        invalidate();
                    } else {
                        // Quick tap with no movement → dismiss
                        if (pluginRef != null) pluginRef.onOverlayCancelled();
                        stopSelf();
                    }
                    return true;
            }
            return super.onTouchEvent(event);
        }
    }

    private void captureAndCrop() {
        captureAndCrop("");
    }

    private void captureAndCrop(String query) {
        pendingQuery = query;
        if (!captureReady || mediaProjection == null) {
            if (query.isEmpty()) {
                if (pluginRef != null) pluginRef.onOverlayCancelled();
            } else {
                if (pluginRef != null) pluginRef.onQuerySubmitted(query);
            }
            stopSelf();
            return;
        }

        Rect bounds = getDrawPathBounds();
        if (bounds == null || bounds.isEmpty()) {
            if (query.isEmpty()) {
                if (pluginRef != null) pluginRef.onOverlayCancelled();
            } else {
                if (pluginRef != null) pluginRef.onQuerySubmitted(query);
            }
            stopSelf();
            return;
        }

        captureScreenRegion(bounds);
    }

    private Rect getDrawPathBounds() {
        if (drawPath.isEmpty()) return null;

        Rect bounds = new Rect();
        android.graphics.RectF boundsF = new android.graphics.RectF();
        drawPath.computeBounds(boundsF, true);

        int padding = 20;
        bounds.left = Math.max(0, (int) boundsF.left - padding);
        bounds.top = Math.max(0, (int) boundsF.top - padding);
        bounds.right = Math.min(displayWidth, (int) boundsF.right + padding);
        bounds.bottom = Math.min(displayHeight, (int) boundsF.bottom + padding);

        if (bounds.width() < 20 || bounds.height() < 20) return null;
        return bounds;
    }

    private void captureScreenRegion(Rect region) {
        if (mediaProjection == null) {
            if (pluginRef != null) pluginRef.onOverlayCancelled();
            stopSelf();
            return;
        }

        int width = displayWidth;
        int height = displayHeight;

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);

        virtualDisplay = mediaProjection.createVirtualDisplay(
            "GIAOverlayCapture",
            width, height, densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(), null, null
        );

        Handler handler = new Handler(Looper.getMainLooper());

        imageReader.setOnImageAvailableListener(reader -> {
            try (Image image = reader.acquireLatestImage()) {
                if (image != null) {
                    Bitmap fullBitmap = imageToBitmap(image);
                    Bitmap cropped = Bitmap.createBitmap(
                        fullBitmap,
                        region.left, region.top,
                        region.width(), region.height()
                    );
                    fullBitmap.recycle();

                    Bitmap masked = applyCircleMask(cropped);
                    cropped.recycle();

                    String dataUrl = bitmapToDataUrl(masked);
                    masked.recycle();

                    releaseVirtualDisplay();

                    if (pluginRef != null) {
                        pluginRef.onRegionCaptured(dataUrl, pendingQuery);
                    }
                    stopSelf();
                }
            } catch (Exception e) {
                releaseVirtualDisplay();
                if (pluginRef != null) pluginRef.onOverlayCancelled();
                stopSelf();
            }
        }, handler);

        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (imageReader != null) {
                imageReader.setOnImageAvailableListener(null, null);
            }
            releaseVirtualDisplay();
        }, 2000);
    }

    private Bitmap imageToBitmap(Image image) {
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * displayWidth;

        Bitmap bitmap = Bitmap.createBitmap(
            displayWidth + rowPadding / pixelStride,
            displayHeight,
            Bitmap.Config.ARGB_8888
        );
        bitmap.copyPixelsFromBuffer(buffer);
        return Bitmap.createBitmap(bitmap, 0, 0, displayWidth, displayHeight);
    }

    private Bitmap applyCircleMask(Bitmap input) {
        Bitmap output = Bitmap.createBitmap(input.getWidth(), input.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(0xFFFFFFFF);
        canvas.drawRoundRect(0, 0, input.getWidth(), input.getHeight(), 16, 16, paint);

        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(input, 0, 0, paint);
        return output;
    }

    private String bitmapToDataUrl(Bitmap bitmap) {
        ByteArrayOutputStream stream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 95, stream);
        byte[] bytes = stream.toByteArray();
        String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);
        return "data:image/png;base64," + base64;
    }

    private void releaseVirtualDisplay() {
        if (imageReader != null) {
            imageReader.setOnImageAvailableListener(null, null);
            imageReader.close();
            imageReader = null;
        }
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
    }

    private void releaseMediaProjection() {
        releaseVirtualDisplay();
        if (mediaProjection != null) {
            mediaProjection.stop();
            mediaProjection = null;
        }
    }

    private void hideOverlayView() {
        if (overlayView != null && windowManager != null) {
            try {
                windowManager.removeView(overlayView);
            } catch (Exception ignored) {}
            overlayView = null;
        }
    }
}
