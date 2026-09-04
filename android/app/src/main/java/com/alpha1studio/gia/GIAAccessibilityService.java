package com.alpha1studio.gia;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityService.ScreenshotResult;
import android.accessibilityservice.AccessibilityService.TakeScreenshotCallback;
import android.accessibilityservice.GestureDescription;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.graphics.Point;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.DisplayMetrics;
import android.view.Display;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

public class GIAAccessibilityService extends AccessibilityService {

    private static final String TAG = "GIAAccessibility";
    private static final String CHANNEL_ID = "GIAAccessibilityChannel";
    private static final int NOTIFICATION_ID = 1003;

    private static final String ACTION_CAPTURE_SCREEN = "com.alpha1studio.gia.ACTION_CAPTURE_SCREEN";
    public static final String ACTION_SCREEN_CAPTURED = "com.alpha1studio.gia.ACTION_SCREEN_CAPTURED";
    public static final String EXTRA_IMAGE_PATH = "image_path";

    private static GIAAccessibilityService instance;
    private static boolean mediaProjectionEnabled = false;

    private MediaProjectionManager mediaProjectionManager;
    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private int displayWidth;
    private int displayHeight;
    private int densityDpi;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // -----------------------------------------------------------------------
    // Static API
    // -----------------------------------------------------------------------

    public static GIAAccessibilityService getInstance() {
        return instance;
    }

    public static boolean isRunning() {
        return instance != null;
    }

    public static void setMediaProjectionEnabled(boolean enabled) {
        mediaProjectionEnabled = enabled;
    }

    /**
     * Capture the full screen and return the file path, or null on failure.
     * Must be called from the main thread (or posted to it).
     *
     * On Android 11+ (API 30) this uses AccessibilityService.takeScreenshot()
     * which captures silently — no MediaProjection consent dialog, works from
     * the orb / gesture flow instantly. Falls back to the legacy MediaProjection
     * path (which needs a granted projection) on older devices or on failure.
     */
    @Nullable
    public static String captureScreen() {
        if (instance == null) {
            return null;
        }
        // API 30+: silent accessibility screenshot — no consent dialog needed.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            String path = instance.captureScreenViaAccessibility();
            if (path != null) {
                return path;
            }
            android.util.Log.w(TAG, "takeScreenshot unavailable, falling back to MediaProjection path");
        }
        if (!mediaProjectionEnabled) {
            return null;
        }
        return instance.captureScreenInternal();
    }

    /**
     * Silent full-screen capture via AccessibilityService.takeScreenshot()
     * (API 30+). Returns a PNG file path or null on any failure.
     */
    @Nullable
    private String captureScreenViaAccessibility() {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicReference<String> result = new AtomicReference<>(null);
        final AtomicInteger failure = new AtomicInteger(Integer.MIN_VALUE);

        mainHandler.post(() -> {
            try {
                takeScreenshot(
                    Display.DEFAULT_DISPLAY,
                    Executors.newSingleThreadExecutor(),
                    new TakeScreenshotCallback() {
                        @Override
                        public void onSuccess(ScreenshotResult screenshot) {
                            try {
                                Bitmap bitmap = Bitmap.wrapHardwareBuffer(
                                    screenshot.getHardwareBuffer(),
                                    screenshot.getColorSpace()
                                );
                                if (bitmap != null) {
                                    result.set(saveScreenshot(bitmap));
                                }
                            } catch (Exception e) {
                                android.util.Log.e(TAG, "takeScreenshot bitmap conversion failed", e);
                            } finally {
                                if (screenshot.getHardwareBuffer() != null) {
                                    screenshot.getHardwareBuffer().close();
                                }
                                latch.countDown();
                            }
                        }

                        @Override
                        public void onFailure(int errorCode) {
                            failure.set(errorCode);
                            latch.countDown();
                        }
                    }
                );
            } catch (Exception e) {
                android.util.Log.e(TAG, "takeScreenshot call failed", e);
                latch.countDown();
            }
        });

        try {
            if (!latch.await(3, TimeUnit.SECONDS)) {
                android.util.Log.w(TAG, "takeScreenshot timed out");
                return null;
            }
        } catch (InterruptedException e) {
            return null;
        }
        if (failure.get() != Integer.MIN_VALUE) {
            android.util.Log.w(TAG, "takeScreenshot failed, code=" + failure.get());
        }
        return result.get();
    }

    /** Save a bitmap to cache and return the file path, or null on failure. */
    @Nullable
    private String saveScreenshot(Bitmap bitmap) {
        try {
            File cacheDir = getCacheDir();
            File screenshotsDir = new File(cacheDir, "screenshots");
            if (!screenshotsDir.exists()) {
                screenshotsDir.mkdirs();
            }
            File outputFile = new File(screenshotsDir, "gia_capture_" + System.currentTimeMillis() + ".png");
            try (FileOutputStream fos = new FileOutputStream(outputFile)) {
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
                fos.flush();
            }
            return outputFile.getAbsolutePath();
        } catch (IOException e) {
            android.util.Log.e(TAG, "saveScreenshot failed", e);
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Service lifecycle
    // -----------------------------------------------------------------------

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        mediaProjectionManager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        createNotificationChannel();

        // Listen for capture requests from the app
        registerReceiver(
                captureReceiver,
                new IntentFilter(ACTION_CAPTURE_SCREEN)
        );

        // Query display metrics up front
        WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        Display display = wm.getDefaultDisplay();
        Point size = new Point();
        display.getRealSize(size);
        displayWidth = size.x;
        displayHeight = size.y;
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        densityDpi = metrics.densityDpi;
    }

    @Override
    public void onDestroy() {
        instance = null;
        unregisterReceiver(captureReceiver);
        releaseMediaProjection();
        super.onDestroy();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Minimal handling — events are used to keep the service alive
        // and trigger re-initialisation if needed.
    }

    @Override
    public void onInterrupt() {
        // Service was interrupted by the system; resources may be released.
    }

    // -----------------------------------------------------------------------
    // Gesture shortcut → screen capture
    // -----------------------------------------------------------------------

    /**
     * Called when the user performs the accessibility gesture shortcut
     * (e.g. long-press volume buttons, three-finger swipe, or a configured
     * system gesture) that is assigned to this service in Settings.
     */
    @Override
    protected boolean onGesture(int gestureId) {
        if (!mediaProjectionEnabled) {
            return super.onGesture(gestureId);
        }
        captureAndBroadcast();
        return true;
    }

    /**
     * Capture current screen and broadcast the result to MainActivity.
     */
    private void captureAndBroadcast() {
        String path = captureScreen();
        if (path != null) {
            Intent intent = new Intent(ACTION_SCREEN_CAPTURED);
            intent.putExtra(EXTRA_IMAGE_PATH, path);
            // Send broadcast for plugins (originally used LocalBroadcastManager + global;
            // modern AndroidX doesn't ship LocalBroadcastManager, so just use global)
            sendBroadcast(intent);
        }
    }

    // -----------------------------------------------------------------------
    // Screen capture
    // -----------------------------------------------------------------------

    @Nullable
    private String captureScreenInternal() {
        if (mediaProjection == null) {
            initMediaProjection();
        }
        if (mediaProjection == null || imageReader == null) {
            return null;
        }

        Image image = imageReader.acquireLatestImage();
        if (image == null) {
            return null;
        }

        int width = image.getWidth();
        int height = image.getHeight();
        Image.Plane[] planes = image.getPlanes();
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * width;

        Bitmap bitmap = Bitmap.createBitmap(
                width + rowPadding / pixelStride,
                height,
                Bitmap.Config.ARGB_8888
        );
        bitmap.copyPixelsFromBuffer(buffer);
        image.close();

        // Crop to actual content width
        if (rowPadding > 0) {
            Bitmap cropped = Bitmap.createBitmap(bitmap, 0, 0, width, height);
            bitmap.recycle();
            bitmap = cropped;
        }

        // Save to cache directory
        File screenshotsDir = new File(getCacheDir(), "screenshots");
        if (!screenshotsDir.exists()) {
            screenshotsDir.mkdirs();
        }
        File outputFile = new File(screenshotsDir, "gia_capture_" + System.currentTimeMillis() + ".png");

        try (FileOutputStream fos = new FileOutputStream(outputFile)) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.flush();
        } catch (IOException e) {
            e.printStackTrace();
            return null;
        } finally {
            bitmap.recycle();
        }

        return outputFile.getAbsolutePath();
    }

    // -----------------------------------------------------------------------
    // MediaProjection helpers
    // -----------------------------------------------------------------------

    private void initMediaProjection() {
        if (mediaProjectionManager == null) {
            mediaProjectionManager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        }

        // Use a VirtualDisplay tunnel without a user-facing prompt.
        // The service is expected to have been granted MEDIA_PROJECTION
        // via the companion app flow or ADB grant.
        // We create a temporary VirtualDisplay backed by an ImageReader.
        int flags = DisplayManager.VIRTUAL_DISPLAY_FLAG_OWN_CONTENT_ONLY
                | DisplayManager.VIRTUAL_DISPLAY_FLAG_PUBLIC;

        imageReader = ImageReader.newInstance(
                displayWidth,
                displayHeight,
                PixelFormat.RGBA_8888,
                2
        );

        // For a non-prompt approach we initialise with a dummy projection.
        // In production the app must call setMediaProjection(Intent, int)
        // after the user consent, or grant via 'adb shell appops set'.
        // The service stores the projection reference statically.
        if (VirtualDisplayHolder.projection != null) {
            mediaProjection = VirtualDisplayHolder.projection;
            virtualDisplay = mediaProjection.createVirtualDisplay(
                    "GIAScreenCapture",
                    displayWidth,
                    displayHeight,
                    densityDpi,
                    flags,
                    imageReader.getSurface(),
                    null,
                    mainHandler
            );
        }
    }

    private void releaseMediaProjection() {
        if (virtualDisplay != null) {
            virtualDisplay.release();
            virtualDisplay = null;
        }
        if (imageReader != null) {
            imageReader.close();
            imageReader = null;
        }
        mediaProjection = null;
    }

    // -----------------------------------------------------------------------
    // Receiver for capture requests from app code
    // -----------------------------------------------------------------------

    private final BroadcastReceiver captureReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            captureAndBroadcast();
        }
    };

    // -----------------------------------------------------------------------
    // Notification
    // -----------------------------------------------------------------------

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Circle-to-Search",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("GIA accessibility service for screen capture");
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
                .setContentTitle("GIA Circle-to-Search")
                .setContentText("Ready to capture screen via gesture")
                .setSmallIcon(android.R.drawable.ic_menu_camera)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .build();
    }

    // -----------------------------------------------------------------------
    // Holder for a MediaProjection obtained outside the service
    // -----------------------------------------------------------------------

    public static class VirtualDisplayHolder {
        @Nullable
        public static MediaProjection projection;

        private VirtualDisplayHolder() {
        }
    }
}
