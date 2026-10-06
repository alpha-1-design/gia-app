package com.alpha1studio.gia;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.inputmethod.EditorInfo;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

@CapacitorPlugin(name = "GIAInAppBrowser")
public class GIAInAppBrowserPlugin extends Plugin {
    private FrameLayout overlay;
    private WebView webView;
    private EditText addressBar;
    private PluginCall pendingNavigation;

    @SuppressLint("SetJavaScriptEnabled")
    private void ensureBrowser() {
        if (overlay != null) return;

        overlay = new FrameLayout(getContext());
        overlay.setBackgroundColor(Color.rgb(12, 12, 16));
        LinearLayout column = new LinearLayout(getContext());
        column.setOrientation(LinearLayout.VERTICAL);
        overlay.addView(column, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        ));

        LinearLayout toolbar = new LinearLayout(getContext());
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(6), dp(5), dp(6), dp(5));
        toolbar.setBackgroundColor(Color.rgb(24, 24, 30));
        column.addView(toolbar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(52)
        ));

        addToolbarButton(toolbar, "Back", "‹", () -> {
            if (webView != null && webView.canGoBack()) webView.goBack();
        });
        addToolbarButton(toolbar, "Forward", "›", () -> {
            if (webView != null && webView.canGoForward()) webView.goForward();
        });
        addToolbarButton(toolbar, "Reload", "↻", () -> {
            if (webView != null) webView.reload();
        });

        addressBar = new EditText(getContext());
        addressBar.setSingleLine(true);
        addressBar.setTextSize(13);
        addressBar.setTextColor(Color.WHITE);
        addressBar.setHintTextColor(Color.rgb(155, 155, 165));
        addressBar.setHint("https://");
        addressBar.setPadding(dp(10), 0, dp(10), 0);
        addressBar.setImeOptions(EditorInfo.IME_ACTION_GO);
        addressBar.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        GradientDrawable addressBackground = new GradientDrawable();
        addressBackground.setColor(Color.rgb(38, 38, 46));
        addressBackground.setCornerRadius(dp(10));
        addressBar.setBackground(addressBackground);
        toolbar.addView(addressBar, new LinearLayout.LayoutParams(0, dp(38), 1));
        addressBar.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                navigateFromAddressBar();
                return true;
            }
            return false;
        });

        addToolbarButton(toolbar, "Go", "Go", this::navigateFromAddressBar);
        addToolbarButton(toolbar, "Close browser", "×", this::hideBrowser);

        webView = new WebView(getContext());
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isHttpUrl(request.getUrl().toString());
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (addressBar != null) addressBar.setText(url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (addressBar != null) addressBar.setText(url);
                PluginCall call = pendingNavigation;
                if (call != null) {
                    pendingNavigation = null;
                    resolvePage(call);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    PluginCall call = pendingNavigation;
                    if (call != null) {
                        pendingNavigation = null;
                        call.reject("The page could not be loaded: " + error.getDescription());
                    }
                }
            }
        });
        column.addView(webView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1
        ));
    }

    private int dp(int value) {
        return Math.round(value * getContext().getResources().getDisplayMetrics().density);
    }

    private void addToolbarButton(LinearLayout toolbar, String label, String text, Runnable action) {
        TextView button = new TextView(getContext());
        button.setText(text);
        button.setTextColor(Color.WHITE);
        button.setTextSize(text.length() > 1 ? 11 : 23);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setContentDescription(label);
        button.setClickable(true);
        button.setFocusable(true);
        button.setOnClickListener(view -> action.run());
        toolbar.addView(button, new LinearLayout.LayoutParams(dp(text.length() > 1 ? 42 : 36), dp(40)));
    }

    private void showBrowser() {
        ensureBrowser();
        ViewGroup decor = (ViewGroup) getActivity().getWindow().getDecorView();
        if (overlay.getParent() == null) {
            decor.addView(overlay, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            ));
        }
        overlay.setVisibility(View.VISIBLE);
    }

    private void hideBrowser() {
        if (overlay != null && overlay.getParent() instanceof ViewGroup) {
            ((ViewGroup) overlay.getParent()).removeView(overlay);
        }
        if (pendingNavigation != null) {
            pendingNavigation.reject("Browser closed before navigation completed");
            pendingNavigation = null;
        }
    }

    private void navigateFromAddressBar() {
        if (addressBar == null) return;
        String url = addressBar.getText().toString().trim();
        if (url.isEmpty()) return;
        if (!url.matches("(?i)^https?://.*")) url = "https://" + url;
        if (isHttpUrl(url)) webView.loadUrl(url);
        else addressBar.setError("Only HTTP and HTTPS URLs are allowed");
    }

    private boolean isHttpUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            String scheme = uri.getScheme();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String requestedUrl(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !isHttpUrl(url)) {
            call.reject("Only valid HTTP and HTTPS URLs are allowed");
            return null;
        }
        return url;
    }

    private void navigate(String url, PluginCall call) {
        showBrowser();
        if (url.equals(webView.getUrl())) {
            resolvePage(call);
            return;
        }
        if (pendingNavigation != null) pendingNavigation.reject("Navigation was replaced");
        pendingNavigation = call;
        webView.loadUrl(url);
    }

    private void resolvePage(PluginCall call) {
        if (webView == null) {
            call.reject("Browser is not open");
            return;
        }
        evaluatePage(call, pageSnapshotScript());
    }

    private String pageSnapshotScript() {
        return "(()=>({url:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,50000)}))()";
    }

    private void evaluatePage(PluginCall call, String script) {
        if (webView == null) {
            call.reject("Browser is not open");
            return;
        }
        webView.evaluateJavascript(script, raw -> {
            try {
                JSONObject data = new JSONObject(raw);
                JSObject result = new JSObject();
                result.put("url", data.optString("url", webView.getUrl()));
                result.put("title", data.optString("title", ""));
                result.put("text", data.optString("text", ""));
                if (data.has("error")) {
                    call.reject(data.optString("error"));
                    return;
                }
                call.resolve(result);
            } catch (Exception error) {
                call.reject("Could not read the current page", error);
            }
        });
    }

    private void runActionThenRead(PluginCall call, String script, int waitMs) {
        if (webView == null) {
            call.reject("Browser is not open");
            return;
        }
        webView.evaluateJavascript(script, raw -> {
            try {
                JSONObject result = new JSONObject(raw);
                if (result.has("error")) {
                    call.reject(result.optString("error"));
                    return;
                }
                webView.postDelayed(() -> resolvePage(call), waitMs);
            } catch (Exception error) {
                call.reject("Could not interact with the current page", error);
            }
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            showBrowser();
            call.resolve();
        });
    }

    @PluginMethod
    public void open(PluginCall call) {
        String url = requestedUrl(call);
        if (url == null) return;
        getActivity().runOnUiThread(() -> navigate(url, call));
    }

    @PluginMethod
    public void navigate(PluginCall call) {
        open(call);
    }

    @PluginMethod
    public void readPage(PluginCall call) {
        getActivity().runOnUiThread(() -> resolvePage(call));
    }

    @PluginMethod
    public void click(PluginCall call) {
        String selector = call.getString("selector");
        if (selector == null || selector.isEmpty() || selector.length() > 500) {
            call.reject("A CSS selector of 1 to 500 characters is required");
            return;
        }
        int waitMs = Math.max(0, Math.min(call.getInt("waitMs", 500), 5000));
        String quotedSelector = JSONObject.quote(selector);
        String script = "(()=>{const e=document.querySelector(" + quotedSelector + ");"
            + "if(!e)return {error:'No element matched the selector'};e.click();return {ok:true}})()";
        getActivity().runOnUiThread(() -> runActionThenRead(call, script, waitMs));
    }

    @PluginMethod
    public void fill(PluginCall call) {
        String selector = call.getString("selector");
        String value = call.getString("value");
        boolean submit = call.getBoolean("submit", false);
        if (selector == null || selector.isEmpty() || selector.length() > 500 || value == null || value.length() > 5000) {
            call.reject("A valid CSS selector and value of at most 5000 characters are required");
            return;
        }
        String script = "(()=>{const e=document.querySelector(" + JSONObject.quote(selector) + ");"
            + "if(!e)return {error:'No element matched the selector'};"
            + "if('value' in e){const p=Object.getPrototypeOf(e),s=Object.getOwnPropertyDescriptor(p,'value')?.set;"
            + "if(s)s.call(e," + JSONObject.quote(value) + ");else e.value=" + JSONObject.quote(value) + ";}"
            + "else if(e.isContentEditable)e.textContent=" + JSONObject.quote(value) + ";"
            + "else return {error:'The selected element cannot be filled'};"
            + "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));"
            + (submit ? "if(e.form)e.form.requestSubmit();" : "")
            + "return {ok:true}})()";
        getActivity().runOnUiThread(() -> runActionThenRead(call, script, submit ? 1000 : 100));
    }

    @PluginMethod
    public void scroll(PluginCall call) {
        String direction = call.getString("direction", "down");
        int amount = call.getInt("amount", 500);
        if (!"down".equals(direction) && !"up".equals(direction) && !"top".equals(direction) && !"bottom".equals(direction)) {
            call.reject("Direction must be down, up, top, or bottom");
            return;
        }
        amount = Math.max(0, Math.min(amount, 10000));
        String script;
        if ("top".equals(direction)) script = "(()=>{window.scrollTo(0,0);return " + pageSnapshotScript() + "})()";
        else if ("bottom".equals(direction)) script = "(()=>{window.scrollTo(0,document.documentElement.scrollHeight);return " + pageSnapshotScript() + "})()";
        else {
            int delta = "up".equals(direction) ? -amount : amount;
            script = "(()=>{window.scrollBy(0," + delta + ");return " + pageSnapshotScript() + "})()";
        }
        getActivity().runOnUiThread(() -> evaluatePage(call, script));
    }

    @PluginMethod
    public void back(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (webView != null && webView.canGoBack()) webView.goBack();
            call.resolve();
        });
    }

    @PluginMethod
    public void forward(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (webView != null && webView.canGoForward()) webView.goForward();
            call.resolve();
        });
    }

    @PluginMethod
    public void reload(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (webView != null) webView.reload();
            call.resolve();
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            hideBrowser();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        hideBrowser();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        overlay = null;
        addressBar = null;
        super.handleOnDestroy();
    }
}
