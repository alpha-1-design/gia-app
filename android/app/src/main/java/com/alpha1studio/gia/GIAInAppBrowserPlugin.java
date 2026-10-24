package com.alpha1studio.gia;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Message;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "GIAInAppBrowser")
public class GIAInAppBrowserPlugin extends Plugin {
    private static final int COLOR_BG = Color.rgb(11, 11, 17);
    private static final int COLOR_SURFACE = Color.rgb(17, 17, 24);
    private static final int COLOR_SURFACE_2 = Color.rgb(28, 28, 36);
    private static final int COLOR_BORDER = Color.rgb(42, 42, 53);
    private static final int COLOR_TEXT = Color.rgb(228, 228, 231);
    private static final int COLOR_MUTED = Color.rgb(161, 161, 170);
    private static final int COLOR_ACCENT = Color.rgb(34, 211, 238);

    private FrameLayout overlay;
    private LinearLayout sheet;
    private WebView webView;
    private EditText addressBar;
    private TextView titleView;
    private TextView controlChip;
    private ProgressBar progressBar;
    private PluginCall pendingNavigation;
    private OnBackPressedCallback backCallback;
    private String controlMode = "user";

    private Context ui() {
        return getActivity() != null ? getActivity() : getContext();
    }

    private int dp(int value) {
        return Math.round(value * ui().getResources().getDisplayMetrics().density);
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void ensureBrowser() {
        if (overlay != null) return;

        overlay = new FrameLayout(ui());
        overlay.setBackgroundColor(Color.TRANSPARENT);
        overlay.setClickable(false);
        overlay.setFocusable(false);

        sheet = new LinearLayout(ui());
        sheet.setOrientation(LinearLayout.VERTICAL);
        sheet.setClickable(true);
        sheet.setFocusable(true);
        GradientDrawable sheetBackground = new GradientDrawable();
        sheetBackground.setColor(COLOR_BG);
        sheetBackground.setCornerRadii(new float[]{
            dp(20), dp(20), dp(20), dp(20), 0, 0, 0, 0
        });
        sheetBackground.setStroke(dp(1), COLOR_BORDER);
        sheet.setBackground(sheetBackground);
        sheet.setClipToOutline(true);
        sheet.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        sheet.setElevation(dp(18));

        FrameLayout.LayoutParams sheetParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(520)
        );
        sheetParams.gravity = Gravity.BOTTOM;
        overlay.addView(sheet, sheetParams);

        View handle = new View(ui());
        GradientDrawable handleBackground = new GradientDrawable();
        handleBackground.setColor(Color.rgb(82, 82, 91));
        handleBackground.setCornerRadius(dp(2));
        handle.setBackground(handleBackground);
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(dp(36), dp(4));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.topMargin = dp(8);
        handleParams.bottomMargin = dp(2);
        sheet.addView(handle, handleParams);

        LinearLayout toolbar = new LinearLayout(ui());
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(2), dp(8), dp(2));
        sheet.addView(toolbar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(48)
        ));

        addToolbarButton(toolbar, "Back", "‹", 20, () -> {
            if (webView != null && webView.canGoBack()) webView.goBack();
        });
        addToolbarButton(toolbar, "Forward", "›", 20, () -> {
            if (webView != null && webView.canGoForward()) webView.goForward();
        });
        addToolbarButton(toolbar, "Reload", "↻", 17, () -> {
            if (webView != null) webView.reload();
        });

        addressBar = new EditText(ui());
        addressBar.setSingleLine(true);
        addressBar.setTextSize(13);
        addressBar.setTextColor(COLOR_TEXT);
        addressBar.setHintTextColor(COLOR_MUTED);
        addressBar.setHint("https://");
        addressBar.setPadding(dp(10), 0, dp(10), 0);
        addressBar.setImeOptions(EditorInfo.IME_ACTION_GO);
        addressBar.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        GradientDrawable addressBackground = new GradientDrawable();
        addressBackground.setColor(COLOR_SURFACE_2);
        addressBackground.setCornerRadius(dp(10));
        addressBar.setBackground(addressBackground);
        LinearLayout.LayoutParams addressParams = new LinearLayout.LayoutParams(0, dp(36), 1);
        addressParams.leftMargin = dp(4);
        addressParams.rightMargin = dp(4);
        toolbar.addView(addressBar, addressParams);
        addressBar.setOnEditorActionListener((view, actionId, event) -> {
            if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE) {
                navigateFromAddressBar();
                return true;
            }
            return false;
        });

        addToolbarButton(toolbar, "Go", "Go", 11, this::navigateFromAddressBar);
        addToolbarButton(toolbar, "Open in your browser", "↗", 17, this::openInExternalBrowser);
        addToolbarButton(toolbar, "Close browser", "×", 22, () -> hideBrowser(true));

        LinearLayout statusRow = new LinearLayout(ui());
        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        statusRow.setPadding(dp(14), 0, dp(14), dp(6));
        titleView = new TextView(ui());
        titleView.setText("GIA browser");
        titleView.setTextSize(10.5f);
        titleView.setTextColor(COLOR_MUTED);
        titleView.setSingleLine(true);
        titleView.setEllipsize(android.text.TextUtils.TruncateAt.END);
        statusRow.addView(titleView, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        controlChip = new TextView(ui());
        controlChip.setTextSize(9);
        controlChip.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        controlChip.setPadding(dp(7), dp(2), dp(7), dp(2));
        statusRow.addView(controlChip, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        sheet.addView(statusRow, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ));
        updateControl("user");

        progressBar = new ProgressBar(ui(), null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setProgressTintList(ColorStateList.valueOf(COLOR_ACCENT));
        progressBar.setVisibility(View.GONE);
        sheet.addView(progressBar, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, dp(2)
        ));

        webView = new WebView(ui());
        webView.setBackgroundColor(COLOR_BG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressBar != null) {
                    progressBar.setProgress(newProgress);
                    progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
                }
            }

            @Override
            public void onReceivedTitle(WebView view, String title) {
                if (titleView != null && title != null && !title.isEmpty()) {
                    titleView.setText(title);
                }
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                if (resultMsg == null || !(resultMsg.obj instanceof WebView.WebViewTransport)) {
                    return false;
                }
                WebView popup = new WebView(ui());
                popup.setWebViewClient(new WebViewClient() {
                    private void sendToMain(String url) {
                        if (url == null || "about:blank".equals(url)) return;
                        if (webView != null) webView.loadUrl(url);
                    }

                    @Override
                    public boolean shouldOverrideUrlLoading(WebView popupView, WebResourceRequest request) {
                        sendToMain(request.getUrl().toString());
                        return true;
                    }

                    @Override
                    public void onPageStarted(WebView popupView, String url, android.graphics.Bitmap favicon) {
                        sendToMain(url);
                    }
                });
                popup.postDelayed(() -> {
                    if (popup.getParent() == null) popup.destroy();
                }, 3000);
                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                return true;
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                return !(isHttpUrl(url) || url.startsWith("capacitor://") || url.startsWith("about:"));
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (addressBar != null && url != null) addressBar.setText(url);
                if (progressBar != null) {
                    progressBar.setProgress(0);
                    progressBar.setVisibility(View.VISIBLE);
                }
                notifyState("loading", null);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (addressBar != null && url != null) addressBar.setText(url);
                if (progressBar != null) progressBar.setVisibility(View.GONE);
                if (titleView != null && view.getTitle() != null && !view.getTitle().isEmpty()) {
                    titleView.setText(view.getTitle());
                }
                updateControl("user");
                notifyState("loaded", null);
                PluginCall call = pendingNavigation;
                if (call != null) {
                    pendingNavigation = null;
                    resolvePage(call);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && request.isForMainFrame()) {
                    String message = "The page could not be loaded: " + error.getDescription();
                    notifyState("error", message);
                    PluginCall call = pendingNavigation;
                    if (call != null) {
                        pendingNavigation = null;
                        call.reject(message);
                    }
                }
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, android.webkit.WebResourceResponse errorResponse) {
                if (request.isForMainFrame()) {
                    int code = errorResponse.getStatusCode();
                    if (code >= 500) {
                        String message = "HTTP " + code + " loading " + request.getUrl();
                        notifyState("error", message);
                        PluginCall call = pendingNavigation;
                        if (call != null) {
                            pendingNavigation = null;
                            call.reject(message);
                        }
                    }
                }
            }
        });

        webView.setOnTouchListener((view, event) -> {
            if (event.getAction() == MotionEvent.ACTION_DOWN) {
                updateControl("user");
                notifyState("control", null);
            }
            return false;
        });

        sheet.addView(webView, new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, 0, 1
        ));

        backCallback = new OnBackPressedCallback(false) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    hideBrowser(true);
                }
            }
        };
        if (getActivity() instanceof ComponentActivity) {
            ((ComponentActivity) getActivity()).getOnBackPressedDispatcher().addCallback(backCallback);
        }
    }

    private void addToolbarButton(LinearLayout toolbar, String label, String text, int textSize, Runnable action) {
        TextView button = new TextView(ui());
        button.setText(text);
        button.setTextColor(COLOR_TEXT);
        button.setTextSize(textSize);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setGravity(Gravity.CENTER);
        button.setContentDescription(label);
        button.setClickable(true);
        button.setFocusable(true);
        button.setOnClickListener(view -> action.run());
        toolbar.addView(button, new LinearLayout.LayoutParams(
            dp(text.length() > 1 ? 40 : 32), dp(38)
        ));
    }

    private void updateSheetHeight() {
        if (sheet == null) return;
        int screenHeight = ui().getResources().getDisplayMetrics().heightPixels;
        int height = Math.max(dp(360), Math.round(screenHeight * 0.66f));
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) sheet.getLayoutParams();
        params.height = height;
        params.gravity = Gravity.BOTTOM;
        params.bottomMargin = navigationBarHeight();
        sheet.setLayoutParams(params);
    }

    private int navigationBarHeight() {
        int id = ui().getResources().getIdentifier("navigation_bar_height", "dimen", "android");
        return id > 0 ? ui().getResources().getDimensionPixelSize(id) : 0;
    }

    private void showBrowser() {
        if (getActivity() == null) return;
        ensureBrowser();
        ViewGroup decor = (ViewGroup) getActivity().getWindow().getDecorView();
        if (overlay.getParent() == null) {
            decor.addView(overlay, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            ));
        }
        overlay.setVisibility(View.VISIBLE);
        overlay.bringToFront();
        updateSheetHeight();
        if (backCallback != null) backCallback.setEnabled(true);
        notifyState("open", null);
    }

    private void hideBrowser(boolean notify) {
        if (overlay != null && overlay.getParent() instanceof ViewGroup) {
            ((ViewGroup) overlay.getParent()).removeView(overlay);
        }
        if (pendingNavigation != null) {
            pendingNavigation.reject("Browser closed before navigation completed");
            pendingNavigation = null;
        }
        if (backCallback != null) backCallback.setEnabled(false);
        if (notify) notifyState("closed", null);
    }

    private void navigateFromAddressBar() {
        if (addressBar == null || webView == null) return;
        String url = addressBar.getText().toString().trim();
        if (url.isEmpty()) return;
        if (!url.matches("(?i)^https?://.*")) url = "https://" + url;
        if (isHttpUrl(url)) {
            updateControl("user");
            webView.loadUrl(url);
        } else {
            addressBar.setError("Only HTTP and HTTPS URLs are allowed");
        }
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
        updateControl("gia");
        if (url.equals(webView.getUrl())) {
            updateControl("user");
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

    private String cursorScript() {
        return "(()=>{"
            + "const id='__gia_cursor_root__';"
            + "let root=document.getElementById(id);"
            + "if(!root){root=document.createElement('div');root.id=id;"
            + "root.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:2147483647;';"
            + "const ring=document.createElement('div');ring.dataset.giaRing='1';"
            + "ring.style.cssText='position:fixed;border:2px solid #22d3ee;border-radius:8px;box-shadow:0 0 0 4px rgba(34,211,238,.14),0 0 20px rgba(34,211,238,.35);opacity:0;transition:left .18s ease,top .18s ease,width .18s ease,height .18s ease,opacity .18s ease;';"
            + "const dot=document.createElement('div');dot.dataset.giaDot='1';"
            + "dot.style.cssText='position:fixed;width:14px;height:14px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#a855f7 55%,#22d3ee);box-shadow:0 0 14px rgba(168,85,247,.8);opacity:0;transform:translate(-50%,-50%);transition:left .18s ease,top .18s ease,opacity .18s ease;';"
            + "const label=document.createElement('div');label.dataset.giaLabel='1';"
            + "label.textContent='GIA';"
            + "label.style.cssText='position:fixed;font:600 10px -apple-system,BlinkMacSystemFont,sans-serif;letter-spacing:.04em;color:#09090b;background:#22d3ee;padding:3px 6px;border-radius:5px;box-shadow:0 2px 10px rgba(0,0,0,.35);opacity:0;transition:left .18s ease,top .18s ease,opacity .18s ease;';"
            + "root.appendChild(ring);root.appendChild(dot);root.appendChild(label);document.documentElement.appendChild(root);}"
            + "const ring=root.querySelector('[data-gia-ring]');"
            + "const dot=root.querySelector('[data-gia-dot]');"
            + "const label=root.querySelector('[data-gia-label]');"
            + "window.__giaCursor=(el,text)=>{try{el.scrollIntoView({block:'center',inline:'center'});"
            + "const r=el.getBoundingClientRect();"
            + "ring.style.left=Math.max(2,r.left-5)+'px';ring.style.top=Math.max(2,r.top-5)+'px';"
            + "ring.style.width=Math.max(10,r.width+10)+'px';ring.style.height=Math.max(10,r.height+10)+'px';ring.style.opacity='1';"
            + "dot.style.left=(r.left+r.width/2)+'px';dot.style.top=(r.top+r.height/2)+'px';dot.style.opacity='1';"
            + "label.textContent=text||'GIA';label.style.left=Math.max(4,r.left)+'px';label.style.top=Math.max(4,r.top-25)+'px';label.style.opacity='1';"
            + "clearTimeout(window.__giaCursorTimer);window.__giaCursorTimer=setTimeout(()=>{ring.style.opacity='0';dot.style.opacity='0';label.style.opacity='0';},1600);"
            + "return true;}catch(e){return false;}};"
            + "return true;})()";
    }

    private String pageSnapshotScript() {
        return "(()=>{"
            + "const text=(document.body?.innerText||'').slice(0,50000);"
            + "const sel=(el)=>{"
            + "if(el.id&&/^[A-Za-z][\\w-]*$/.test(el.id))return '#'+el.id;"
            + "const name=el.getAttribute('name');if(name)return el.tagName.toLowerCase()+'[name='+JSON.stringify(name)+']';"
            + "const aria=el.getAttribute('aria-label');if(aria)return el.tagName.toLowerCase()+'[aria-label='+JSON.stringify(aria)+']';"
            + "const parts=[];let node=el;while(node&&node.nodeType===1&&parts.length<5){"
            + "let part=node.tagName.toLowerCase();"
            + "if(node.id&&/^[A-Za-z][\\w-]*$/.test(node.id)){parts.unshift('#'+node.id);break;}"
            + "const parent=node.parentElement;const siblings=parent?Array.from(parent.children).filter(x=>x.tagName===node.tagName):[];"
            + "if(siblings.length>1)part+=':nth-of-type('+(siblings.indexOf(node)+1)+')';"
            + "parts.unshift(part);node=parent;}"
            + "return parts.join(' > ');};"
            + "const nodes=Array.from(document.querySelectorAll('a,button,input,textarea,select,[role=\"button\"],[role=\"link\"],[contenteditable=\"true\"]'));"
            + "const items=[];for(const el of nodes){"
            + "const r=el.getBoundingClientRect();const s=getComputedStyle(el);"
            + "if(r.width<=0||r.height<=0||s.display==='none'||s.visibility==='hidden')continue;"
            + "const label=(el.innerText||el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.getAttribute('name')||'').replace(/\\s+/g,' ').trim().slice(0,120);"
            + "items.push({tag:el.tagName.toLowerCase(),selector:sel(el),text:label,type:el.getAttribute('type')||'',href:el.href||''});"
            + "if(items.length>=80)break;}"
            + "return {url:location.href,title:document.title,text:text,items:items};})()";
    }

    private void evaluatePage(PluginCall call, String script) {
        if (webView == null) {
            call.reject("Browser is not open");
            return;
        }
        webView.evaluateJavascript(script, raw -> {
            try {
                JSONObject data = new JSONObject(raw);
                if (data.has("error")) {
                    call.reject(data.optString("error"));
                    return;
                }
                JSObject result = new JSObject();
                result.put("url", data.optString("url", webView.getUrl()));
                result.put("title", data.optString("title", ""));
                result.put("text", data.optString("text", ""));
                JSONArray items = data.optJSONArray("items");
                if (items != null) result.put("items", items);
                String title = data.optString("title", "");
                if (titleView != null && !title.isEmpty()) titleView.setText(title);
                updateControl("user");
                notifyState("loaded", null);
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

    private void notifyState(String state, String error) {
        JSObject data = new JSObject();
        data.put("state", state);
        data.put("url", webView != null && webView.getUrl() != null ? webView.getUrl() : "");
        data.put("title", titleView != null ? titleView.getText().toString() : "");
        data.put("control", controlMode);
        if (error != null) data.put("error", error);
        notifyListeners("browserState", data);
    }

    private void updateControl(String mode) {
        controlMode = "gia".equals(mode) ? "gia" : "user";
        if (controlChip == null) return;
        boolean gia = "gia".equals(controlMode);
        controlChip.setText(gia ? "GIA" : "You");
        controlChip.setTextColor(gia ? COLOR_ACCENT : COLOR_MUTED);
        GradientDrawable chipBackground = new GradientDrawable();
        chipBackground.setColor(gia ? Color.argb(38, 34, 211, 238) : Color.argb(20, 255, 255, 255));
        chipBackground.setCornerRadius(dp(8));
        controlChip.setBackground(chipBackground);
    }

    private void openInExternalBrowser() {
        if (webView == null) return;
        String url = webView.getUrl();
        if (url == null || !isHttpUrl(url)) return;
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(ui(), "No browser is available to open this page", Toast.LENGTH_SHORT).show();
        }
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
        getActivity().runOnUiThread(() -> {
            showBrowser();
            resolvePage(call);
        });
    }

    @PluginMethod
    public void click(PluginCall call) {
        String selector = call.getString("selector");
        if (selector == null || selector.isEmpty() || selector.length() > 500) {
            call.reject("A CSS selector of 1 to 500 characters is required");
            return;
        }
        int waitMs = Math.max(0, Math.min(call.getInt("waitMs", 500), 5000));
        String script = cursorScript() + ";(()=>{const e=document.querySelector(" + JSONObject.quote(selector) + ");"
            + "if(!e)return {error:'No element matched the selector'};"
            + "window.__giaCursor(e,'Click');"
            + "setTimeout(()=>{try{e.click();}catch(err){}},240);"
            + "return {ok:true}})()";
        getActivity().runOnUiThread(() -> {
            showBrowser();
            updateControl("gia");
            runActionThenRead(call, script, waitMs + 300);
        });
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
        String quotedValue = JSONObject.quote(value);
        String script = cursorScript() + ";(()=>{const e=document.querySelector(" + JSONObject.quote(selector) + ");"
            + "if(!e)return {error:'No element matched the selector'};"
            + "window.__giaCursor(e,'Type');e.focus();"
            + "if('value' in e){const p=Object.getPrototypeOf(e),s=Object.getOwnPropertyDescriptor(p,'value')?.set;"
            + "if(s)s.call(e," + quotedValue + ");else e.value=" + quotedValue + ";}"
            + "else if(e.isContentEditable)e.textContent=" + quotedValue + ";"
            + "else return {error:'The selected element cannot be filled'};"
            + "e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));"
            + (submit ? "setTimeout(()=>{if(e.form){if(e.form.requestSubmit)e.form.requestSubmit();else e.form.submit();}},180);" : "")
            + "return {ok:true}})()";
        getActivity().runOnUiThread(() -> {
            showBrowser();
            updateControl("gia");
            runActionThenRead(call, script, submit ? 1200 : 450);
        });
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
        if ("top".equals(direction)) script = "(()=>{window.scrollTo({top:0,behavior:'smooth'});return " + pageSnapshotScript() + "})()";
        else if ("bottom".equals(direction)) script = "(()=>{window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'});return " + pageSnapshotScript() + "})()";
        else {
            int delta = "up".equals(direction) ? -amount : amount;
            script = "(()=>{window.scrollBy({top:" + delta + ",behavior:'smooth'});return " + pageSnapshotScript() + "})()";
        }
        getActivity().runOnUiThread(() -> {
            showBrowser();
            updateControl("gia");
            evaluatePage(call, script);
        });
    }

    @PluginMethod
    public void back(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            showBrowser();
            updateControl("gia");
            if (webView != null && webView.canGoBack()) webView.goBack();
            call.resolve();
        });
    }

    @PluginMethod
    public void forward(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            showBrowser();
            updateControl("gia");
            if (webView != null && webView.canGoForward()) webView.goForward();
            call.resolve();
        });
    }

    @PluginMethod
    public void reload(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            showBrowser();
            updateControl("gia");
            if (webView != null) webView.reload();
            call.resolve();
        });
    }

    @PluginMethod
    public void setControl(PluginCall call) {
        String mode = call.getString("mode", "user");
        getActivity().runOnUiThread(() -> {
            updateControl("gia".equals(mode) ? "gia" : "user");
            notifyState("control", null);
            call.resolve();
        });
    }

    @PluginMethod
    public void close(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            hideBrowser(true);
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        hideBrowser(false);
        if (backCallback != null) {
            backCallback.remove();
            backCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        overlay = null;
        sheet = null;
        addressBar = null;
        titleView = null;
        controlChip = null;
        progressBar = null;
        super.handleOnDestroy();
    }
}
