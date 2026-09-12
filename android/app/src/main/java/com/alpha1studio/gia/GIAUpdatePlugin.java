package com.alpha1studio.gia;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "GIAUpdate")
public class GIAUpdatePlugin extends Plugin {

    private static final String TAG = "GIAUpdatePlugin";
    private static final int MAX_REDIRECTS = 10;
    // Single canonical location + name for the downloaded update. installApk()
    // reads from exactly this path by default, so download and install can
    // never disagree about where the file lives.
    private static final String UPDATE_SUBDIR = "updates";
    private static final String UPDATE_FILENAME = "gia-update.apk";

    private File updateFile() {
        File dir = new File(getContext().getFilesDir(), UPDATE_SUBDIR);
        dir.mkdirs();
        return new File(dir, UPDATE_FILENAME);
    }

    /**
     * Download an APK from a URL to app-internal storage — natively, off the
     * WebView blob->base64 pipeline that OOMs on low-end devices. Handles
     * GitHub's 302 redirect chain to the CDN. Reports real-time progress via
     * "downloadProgress" events. Does NOT install — call installApk() after
     * this resolves, so the UI's download/ready/install states reflect what
     * has actually happened.
     *
     * @param call must include "url" string
     */
    @PluginMethod
    public void downloadApk(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("url is required");
            return;
        }

        new Thread(() -> {
            File apkFile = updateFile();
            try {
                if (apkFile.exists()) apkFile.delete();

                Log.i(TAG, "Starting download from: " + urlString);
                downloadWithRedirects(urlString, apkFile);

                if (!apkFile.exists() || apkFile.length() < 100_000) {
                    long len = apkFile.exists() ? apkFile.length() : 0;
                    apkFile.delete();
                    call.reject("Download incomplete: " + len + " bytes");
                    return;
                }

                Log.i(TAG, "Download complete: " + (apkFile.length() / 1024) + "KB");

                JSObject progress = new JSObject();
                progress.put("status", "downloaded");
                progress.put("percent", 100);
                progress.put("size", apkFile.length());
                notifyListeners("downloadProgress", progress);

                JSObject result = new JSObject();
                result.put("path", apkFile.getAbsolutePath());
                result.put("size", apkFile.length());
                call.resolve(result);

            } catch (Exception e) {
                Log.e(TAG, "Download failed: " + e.getMessage(), e);
                if (apkFile.exists()) apkFile.delete();
                call.reject("Download failed: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Download a URL to a file, following redirects manually.
     * Uses HttpURLConnection which handles GitHub's 302->CDN chain properly.
     */
    private void downloadWithRedirects(String urlString, File outputFile) throws Exception {
        int redirectCount = 0;
        String currentUrl = urlString;

        while (redirectCount <= MAX_REDIRECTS) {
            URL url = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "GIA-Updater");
            conn.setInstanceFollowRedirects(false); // we handle redirects manually

            try {
                int responseCode = conn.getResponseCode();

                if (responseCode == 301 || responseCode == 302
                    || responseCode == 307 || responseCode == 308) {
                    String location = conn.getHeaderField("Location");
                    conn.disconnect();
                    if (location == null) {
                        throw new Exception("Redirect with no Location header");
                    }
                    if (!location.startsWith("http")) {
                        URL base = new URL(currentUrl);
                        location = new URL(base, location).toString();
                    }
                    currentUrl = location;
                    redirectCount++;
                    Log.i(TAG, "Redirect " + redirectCount + " -> " + location);
                    continue;
                }

                if (responseCode != 200) {
                    throw new Exception("HTTP " + responseCode);
                }

                long totalBytes = conn.getContentLengthLong();
                Log.i(TAG, "Response 200 OK, content-length: " + totalBytes);

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(outputFile)) {

                    byte[] buffer = new byte[8192];
                    long bytesSoFar = 0;
                    int lastPct = -1;
                    int n;

                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                        bytesSoFar += n;

                        // Emit on every whole-percent change (or every chunk
                        // if total length is unknown) — no more guessing at
                        // a mixed byte/percent threshold.
                        int pct = totalBytes > 0 ? (int) ((bytesSoFar * 100L) / totalBytes) : -1;
                        if (pct != lastPct) {
                            lastPct = pct;
                            JSObject progress = new JSObject();
                            progress.put("status", "downloading");
                            progress.put("loaded", bytesSoFar);
                            progress.put("total", totalBytes);
                            progress.put("percent", Math.max(pct, 0));
                            notifyListeners("downloadProgress", progress);
                        }
                    }

                    Log.i(TAG, "Downloaded " + bytesSoFar + " bytes to " + outputFile.getAbsolutePath());
                }
                return; // success

            } finally {
                conn.disconnect();
            }
        }

        throw new Exception("Too many redirects (" + redirectCount + ")");
    }

    /**
     * Trigger the Android package installer for a previously-downloaded APK.
     * Reads from the same path downloadApk() writes to by default, so this
     * can never look in the wrong place.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String fileName = call.getString("fileName", UPDATE_FILENAME);
        File apkFile = fileName.equals(UPDATE_FILENAME)
            ? updateFile()
            : new File(new File(getContext().getFilesDir(), UPDATE_SUBDIR), fileName);

        if (!apkFile.exists()) {
            call.reject("APK not found: " + apkFile.getAbsolutePath());
            return;
        }

        try {
            Uri apkUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                apkFile
            );

            Intent intent = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            intent.setData(apkUri);
            intent.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(intent);
            } else {
                // Fallback: ACTION_VIEW with the APK mime type
                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(viewIntent);
            }

            JSObject result = new JSObject();
            result.put("installed", true);
            result.put("path", apkFile.getAbsolutePath());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage());
        }
    }
}
