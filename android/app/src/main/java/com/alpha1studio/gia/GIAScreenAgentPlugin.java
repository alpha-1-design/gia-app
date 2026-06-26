package com.alpha1studio.gia;

import android.content.Intent;
import android.graphics.Rect;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.JsonWriter;
import android.view.accessibility.AccessibilityNodeInfo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.StringWriter;
import java.util.ArrayList;
import java.util.List;

/**
 * Screen Agent Plugin — bridges the Android accessibility service to GIA's web layer.
 * Provides screen content analysis: UI element tree, text extraction, and gesture simulation.
 */
@CapacitorPlugin(name = "GIAScreenAgent")
public class GIAScreenAgentPlugin extends Plugin {

    private static final String EVENT_SCREEN_CHANGED = "screenChanged";
    private static final String EVENT_ELEMENT_FOUND = "elementFound";

    private GIAAccessibilityService accessibilityService;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private boolean isWatching = false;
    private long watchIntervalMs = 3000;
    private String lastScreenHash = "";

    @Override
    public void load() {
        super.load();
        accessibilityService = GIAAccessibilityService.getInstance();
    }

    /**
     * Capture the current screen: screenshot + accessibility node tree.
     * Returns screenshot path, detected text, and interactive elements.
     */
    @PluginMethod
    public void capture(PluginCall call) {
        if (accessibilityService == null || !GIAAccessibilityService.isRunning()) {
            call.reject("Accessibility service not running");
            return;
        }

        String screenshotPath = GIAAccessibilityService.captureScreen();
        AccessibilityNodeInfo root = accessibilityService.getRootInActiveWindow();
        List<ScreenElement> elements = new ArrayList<>();
        String fullText = "";

        if (root != null) {
            collectElements(root, elements, 0);
            fullText = extractAllText(root);
            root.recycle();
        }

        JSObject result = new JSObject();
        if (screenshotPath != null) {
            result.put("screenshotPath", screenshotPath);
        }
        result.put("text", fullText);
        result.put("elementCount", elements.size());
        result.put("elements", elementsToJson(elements));
        result.put("timestamp", System.currentTimeMillis());
        call.resolve(result);
    }

    /**
     * Get all interactive UI elements on screen as structured JSON.
     */
    @PluginMethod
    public void getScreenContent(PluginCall call) {
        if (accessibilityService == null) {
            call.reject("Accessibility service not available");
            return;
        }

        AccessibilityNodeInfo root = accessibilityService.getRootInActiveWindow();
        if (root == null) {
            call.reject("No active window found");
            return;
        }

        List<ScreenElement> elements = new ArrayList<>();
        collectElements(root, elements, 0);
        String fullText = extractAllText(root);
        root.recycle();

        JSObject result = new JSObject();
        result.put("text", fullText);
        result.put("elementCount", elements.size());
        result.put("elements", elementsToJson(elements));
        result.put("timestamp", System.currentTimeMillis());
        call.resolve(result);
    }

    /**
     * Get the full accessibility node tree as nested JSON.
     */
    @PluginMethod
    public void getAccessibilityTree(PluginCall call) {
        if (accessibilityService == null) {
            call.reject("Accessibility service not available");
            return;
        }

        AccessibilityNodeInfo root = accessibilityService.getRootInActiveWindow();
        if (root == null) {
            call.reject("No active window found");
            return;
        }

        String treeJson = nodeToJson(root, 0);
        root.recycle();

        JSObject result = new JSObject();
        result.put("tree", treeJson);
        result.put("timestamp", System.currentTimeMillis());
        call.resolve(result);
    }

    /**
     * Perform a click/tap on the element at the given coordinates.
     */
    @PluginMethod
    public void performTap(PluginCall call) {
        int x = call.getInt("x", -1);
        int y = call.getInt("y", -1);
        if (x < 0 || y < 0) {
            call.reject("x and y coordinates required");
            return;
        }

        if (accessibilityService == null || !GIAAccessibilityService.isRunning()) {
            call.reject("Accessibility service not running");
            return;
        }

        boolean success = performGestureTap(x, y);
        if (success) {
            call.resolve();
        } else {
            call.reject("Failed to perform gesture");
        }
    }

    /**
     * Find an element by its visible text and perform a click on it.
     */
    @PluginMethod
    public void tapText(PluginCall call) {
        String targetText = call.getString("text", "");
        if (targetText.isEmpty()) {
            call.reject("text parameter required");
            return;
        }

        if (accessibilityService == null) {
            call.reject("Accessibility service not available");
            return;
        }

        AccessibilityNodeInfo root = accessibilityService.getRootInActiveWindow();
        if (root == null) {
            call.reject("No active window found");
            return;
        }

        List<AccessibilityNodeInfo> matches = new ArrayList<>();
        findNodesByText(root, targetText.toLowerCase(), matches);

        if (matches.isEmpty()) {
            root.recycle();
            call.reject("No element found with text: " + targetText);
            return;
        }

        AccessibilityNodeInfo target = matches.get(0);
        boolean clicked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            clicked = target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
        }

        // Recycle all collected nodes
        for (AccessibilityNodeInfo node : matches) {
            if (node != target) node.recycle();
        }
        root.recycle();

        JSObject result = new JSObject();
        result.put("clicked", clicked);
        result.put("foundOn", target.getPackageName() != null ? target.getPackageName().toString() : "unknown");
        Rect bounds = new Rect();
        target.getBoundsInScreen(bounds);
        result.put("bounds", boundsToJson(bounds));
        target.recycle();

        call.resolve(result);
    }

    /**
     * Start watching the screen for changes. Fires 'screenChanged' events
     * when the visible content changes.
     */
    @PluginMethod
    public void startWatching(PluginCall call) {
        isWatching = true;
        watchIntervalMs = call.getInt("intervalMs", 3000);
        notifyListeners("watchingStarted", new JSObject());
        startWatchLoop();
        call.resolve();
    }

    /**
     * Stop watching for screen changes.
     */
    @PluginMethod
    public void stopWatching(PluginCall call) {
        isWatching = false;
        call.resolve();
    }

    // -----------------------------------------------------------------------
    // Accessibility Node Tree Parsing
    // -----------------------------------------------------------------------

    private static class ScreenElement {
        String type;
        String text;
        String className;
        String packageName;
        Rect bounds;
        boolean clickable;
        boolean longClickable;
        boolean focusable;
        boolean editable;
        boolean visible;
        boolean scrollable;
        boolean checked;
        String contentDescription;
        int depth;
        String viewIdResourceName;
    }

    private void collectElements(AccessibilityNodeInfo node, List<ScreenElement> elements, int depth) {
        if (node == null) return;
        if (depth > 20) return;

        if (node.isVisibleToUser()) {
            ScreenElement el = new ScreenElement();
            el.depth = depth;
            el.className = node.getClassName() != null ? node.getClassName().toString() : "";
            el.packageName = node.getPackageName() != null ? node.getPackageName().toString() : "";
            el.clickable = node.isClickable();
            el.longClickable = node.isLongClickable();
            el.focusable = node.isFocusable();
            el.editable = node.isEditable();
            el.visible = node.isVisibleToUser();
            el.scrollable = node.isScrollable();
            el.checked = node.isChecked();
            el.contentDescription = node.getContentDescription() != null ? node.getContentDescription().toString() : "";

            if (node.getText() != null) {
                el.text = node.getText().toString();
            } else {
                el.text = el.contentDescription;
            }

            if (node.getViewIdResourceName() != null) {
                el.viewIdResourceName = node.getViewIdResourceName();
            }

            Rect bounds = new Rect();
            node.getBoundsInScreen(bounds);
            el.bounds = bounds;

            // Determine element type
            if (el.editable) {
                el.type = "input";
            } else if (el.clickable && el.className.contains("Button")) {
                el.type = "button";
            } else if (el.clickable && el.className.contains("Image")) {
                el.type = "image";
            } else if (el.className.contains("EditText")) {
                el.type = "input";
            } else if (el.className.contains("CheckBox") || el.className.contains("Switch")) {
                el.type = "checkbox";
            } else if (el.className.contains("Spinner") || el.className.contains("List")) {
                el.type = "list";
            } else if (el.className.contains("TextView") || el.className.contains("Text")) {
                el.type = "text";
            } else if (el.clickable && !el.text.isEmpty()) {
                el.type = "button";
            } else {
                el.type = "other";
            }

            if (!el.text.isEmpty() || !el.contentDescription.isEmpty()) {
                elements.add(el);
            }
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                collectElements(child, elements, depth + 1);
            }
        }
    }

    private String extractAllText(AccessibilityNodeInfo node) {
        if (node == null) return "";
        StringBuilder sb = new StringBuilder();

        if (node.getText() != null && node.isVisibleToUser()) {
            sb.append(node.getText().toString()).append("\n");
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                sb.append(extractAllText(child));
                child.recycle();
            }
        }

        return sb.toString();
    }

    private void findNodesByText(AccessibilityNodeInfo node, String targetText, List<AccessibilityNodeInfo> matches) {
        if (node == null) return;

        String nodeText = node.getText() != null ? node.getText().toString().toLowerCase() : "";
        String nodeDesc = node.getContentDescription() != null ? node.getContentDescription().toString().toLowerCase() : "";

        if ((!nodeText.isEmpty() && nodeText.contains(targetText)) ||
            (!nodeDesc.isEmpty() && nodeDesc.contains(targetText))) {
            matches.add(node);
        } else {
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    findNodesByText(child, targetText, matches);
                    child.recycle();
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Gesture Simulation (accessibility gesture)
    // -----------------------------------------------------------------------

    private boolean performGestureTap(int x, int y) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return false;

        android.accessibilityservice.GestureDescription.Builder builder =
            new android.accessibilityservice.GestureDescription.Builder();

        android.graphics.Path clickPath = new android.graphics.Path();
        clickPath.moveTo(x, y);

        builder.addStroke(new android.accessibilityservice.GestureDescription.StrokeDescription(
            clickPath, 0, 100
        ));

        final boolean[] result = {false};
        final Object lock = new Object();

        accessibilityService.dispatchGesture(
            builder.build(),
            new android.accessibilityservice.AccessibilityService.GestureResultCallback() {
                @Override
                public void onCompleted(android.accessibilityservice.GestureDescription gestureDescription) {
                    synchronized (lock) {
                        result[0] = true;
                        lock.notify();
                    }
                }
                @Override
                public void onCancelled(android.accessibilityservice.GestureDescription gestureDescription) {
                    synchronized (lock) {
                        result[0] = false;
                        lock.notify();
                    }
                }
            },
            null
        );

        try {
            synchronized (lock) {
                lock.wait(2000);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        return result[0];
    }

    // -----------------------------------------------------------------------
    // JSON serialization
    // -----------------------------------------------------------------------

    private String elementsToJson(List<ScreenElement> elements) {
        try {
            StringWriter sw = new StringWriter();
            JsonWriter writer = new JsonWriter(sw);
            writer.beginArray();
            for (ScreenElement el : elements) {
                writer.beginObject();
                writer.name("type").value(el.type);
                writer.name("text").value(el.text);
                writer.name("className").value(el.className);
                if (el.contentDescription != null && !el.contentDescription.isEmpty() && !el.contentDescription.equals(el.text)) {
                    writer.name("contentDescription").value(el.contentDescription);
                }
                writer.name("clickable").value(el.clickable);
                writer.name("longClickable").value(el.longClickable);
                writer.name("focusable").value(el.focusable);
                writer.name("editable").value(el.editable);
                writer.name("scrollable").value(el.scrollable);
                writer.name("depth").value(el.depth);
                if (el.viewIdResourceName != null) {
                    writer.name("viewId").value(el.viewIdResourceName);
                }
                writer.name("bounds");
                writer.beginObject();
                writer.name("left").value(el.bounds.left);
                writer.name("top").value(el.bounds.top);
                writer.name("right").value(el.bounds.right);
                writer.name("bottom").value(el.bounds.bottom);
                writer.name("width").value(el.bounds.width());
                writer.name("height").value(el.bounds.height());
                writer.name("centerX").value(el.bounds.centerX());
                writer.name("centerY").value(el.bounds.centerY());
                writer.endObject();
                writer.endObject();
            }
            writer.endArray();
            writer.close();
            return sw.toString();
        } catch (Exception e) {
            return "[]";
        }
    }

    private JSObject boundsToJson(Rect bounds) {
        JSObject obj = new JSObject();
        obj.put("left", bounds.left);
        obj.put("top", bounds.top);
        obj.put("right", bounds.right);
        obj.put("bottom", bounds.bottom);
        obj.put("width", bounds.width());
        obj.put("height", bounds.height());
        obj.put("centerX", bounds.centerX());
        obj.put("centerY", bounds.centerY());
        return obj;
    }

    private String nodeToJson(AccessibilityNodeInfo node, int depth) {
        if (node == null || depth > 15) return "null";
        try {
            StringWriter sw = new StringWriter();
            JsonWriter writer = new JsonWriter(sw);
            writeNode(writer, node, depth);
            writer.close();
            return sw.toString();
        } catch (Exception e) {
            return "{\"error\":\"" + e.getMessage() + "\"}";
        }
    }

    private void writeNode(JsonWriter writer, AccessibilityNodeInfo node, int depth) throws Exception {
        writer.beginObject();
        writer.name("className").value(node.getClassName() != null ? node.getClassName().toString() : "");
        if (node.getText() != null) writer.name("text").value(node.getText().toString());
        if (node.getContentDescription() != null) writer.name("contentDescription").value(node.getContentDescription().toString());
        writer.name("clickable").value(node.isClickable());
        writer.name("focusable").value(node.isFocusable());
        writer.name("editable").value(node.isEditable());
        writer.name("visible").value(node.isVisibleToUser());
        writer.name("depth").value(depth);

        Rect bounds = new Rect();
        node.getBoundsInScreen(bounds);
        writer.name("bounds");
        writer.beginObject();
        writer.name("left").value(bounds.left);
        writer.name("top").value(bounds.top);
        writer.name("right").value(bounds.right);
        writer.name("bottom").value(bounds.bottom);
        writer.endObject();

        int childCount = node.getChildCount();
        writer.name("childCount").value(childCount);
        if (childCount > 0) {
            writer.name("children");
            writer.beginArray();
            for (int i = 0; i < childCount; i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    writeNode(writer, child, depth + 1);
                    child.recycle();
                } else {
                    writer.nullValue();
                }
            }
            writer.endArray();
        }
        writer.endObject();
    }

    // -----------------------------------------------------------------------
    // Watch loop — polls the screen and fires change events
    // -----------------------------------------------------------------------

    private void startWatchLoop() {
        mainHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (!isWatching) return;

                AccessibilityNodeInfo root = accessibilityService != null
                    ? accessibilityService.getRootInActiveWindow()
                    : null;
                if (root == null) {
                    mainHandler.postDelayed(this, watchIntervalMs);
                    return;
                }

                String currentText = extractAllText(root);
                root.recycle();

                if (!currentText.equals(lastScreenHash)) {
                    lastScreenHash = currentText;
                    JSObject event = new JSObject();
                    event.put("text", currentText.length() > 1000 ? currentText.substring(0, 1000) : currentText);
                    event.put("timestamp", System.currentTimeMillis());
                    notifyListeners(EVENT_SCREEN_CHANGED, event);
                }

                mainHandler.postDelayed(this, watchIntervalMs);
            }
        }, watchIntervalMs);
    }

    /**
     * Show the floating GIA screen orb overlay.
     */
    @PluginMethod
    public void showOrb(PluginCall call) {
        Intent intent = new Intent(getContext(), GIAScreenOrbService.class);
        getContext().startForegroundService(intent);
        call.resolve();
    }

    /**
     * Hide the floating GIA screen orb overlay.
     */
    @PluginMethod
    public void hideOrb(PluginCall call) {
        Intent intent = new Intent(getContext(), GIAScreenOrbService.class);
        getContext().stopService(intent);
        call.resolve();
    }

    /**
     * Check if the floating orb is currently showing.
     */
    @PluginMethod
    public void isOrbShowing(PluginCall call) {
        JSObject result = new JSObject();
        result.put("showing", GIAScreenOrbService.isShowing());
        result.put("size", GIAScreenOrbService.getCurrentSize());
        call.resolve(result);
    }

    /**
     * Set the floating orb size in dp.
     */
    @PluginMethod
    public void setOrbSize(PluginCall call) {
        int sizeDp = call.getInt("size", 56);
        GIAScreenOrbService.setSize(sizeDp);
        call.resolve();
    }

    /**
     * Get the singleton instance of the accessibility service.
     */
    public static GIAAccessibilityService getAccessibilityService() {
        return GIAAccessibilityService.getInstance();
    }
}
