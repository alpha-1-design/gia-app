package com.alpha1studio.gia;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
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

    /**
     * Install a previously-downloaded APK from the cache directory.
     */
    @PluginMethod
    public void installApk(PluginCall call) {
        String fileName = call.getString("fileName", "update.apk");

        try {
            File apkFile = new File(getContext().getCacheDir(), fileName);
            if (!apkFile.exists()) {
                call.reject("APK not found: " + apkFile.getAbsolutePath());
                return;
            }

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
                call.resolve();
            } else {
                call.reject("No package installer available");
            }
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage());
        }
    }

    /**
     * Download an APK from a URL and install it — all natively.
     * Bypasses the WebView blob→base64 pipeline that OOMs on low-end devices.
     * Handles GitHub 302 redirects transparently.
     * Reports progress back to JS via "downloadProgress" events.
     *
     * @param call must include "url" string
     */
    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlString = call.getString("url");
        if (urlString == null || urlString.isEmpty()) {
            call.reject("url is required");
            return;
        }

        // Run download on background thread to avoid blocking the Capacitor bridge
        new Thread(() -> {
            File apkFile = null;
            try {
                // Use app internal storage (not cache — survives cache clears)
                File updateDir = new File(getContext().getFilesDir(), "updates");
                updateDir.mkdirs();
                apkFile = new File(updateDir, "gia-update.apk");

                // Clean previous download
                if (apkFile.exists()) apkFile.delete();

                Log.i(TAG, "Starting download from: " + urlString);
                downloadWithRedirects(urlString, apkFile);

                // Verify file was actually written
                if (!apkFile.exists() || apkFile.length() < 100_000) {
                    call.reject("Download incomplete: " + apkFile.length() + " bytes");
                    return;
                }

                Log.i(TAG, "Download complete: " + (apkFile.length() / 1024) + "KB");

                // Emit download complete event
                JSObject progress = new JSObject();
                progress.put("status", "downloaded");
                progress.put("size", apkFile.length());
                notifyListeners("downloadProgress", progress);

                // Trigger Android package installer
                installFromFile(apkFile, call);

            } catch (Exception e) {
                Log.e(TAG, "Download/install failed: " + e.getMessage(), e);
                // Clean up partial file
                if (apkFile != null && apkFile.exists()) apkFile.delete();
                call.reject("Update failed: " + e.getMessage());
            }
        }).start();
    }

    /**
     * Download a URL to a file, following redirects manually.
     * Uses HttpURLConnection which handles GitHub's 302→CDN chain properly.
     */
    private void downloadWithRedirects(String urlString, File outputFile) throws Exception {
        int redirectCount = 0;
        String currentUrl = urlString;

        while (redirectCount <= MAX_REDIRECTS) {
            URL url = new URL(currentUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "GIA/2.4.0");
            conn.setInstanceFollowRedirects(false); // We handle redirects manually

            try {
                int responseCode = conn.getResponseCode();

                // Handle redirects (301, 302, 307, 308)
                if (responseCode == 301 || responseCode == 302
                    || responseCode == 307 || responseCode == 308) {
                    String location = conn.getHeaderField("Location");
                    conn.disconnect();
                    if (location == null) {
                        throw new Exception("Redirect with no Location header");
                    }
                    // Handle relative redirects
                    if (!location.startsWith("http")) {
                        URL base = new URL(currentUrl);
                        location = new URL(base, location).toString();
                    }
                    currentUrl = location;
                    redirectCount++;
                    Log.i(TAG, "Redirect " + redirectCount + " → " + location);
                    continue;
                }

                if (responseCode != 200) {
                    throw new Exception("HTTP " + responseCode);
                }

                long totalBytes = conn.getContentLengthLong();
                Log.i(TAG, "Response 200 OK, content-length: " + totalBytes);

                // Download to file with progress reporting
                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(outputFile)) {

                    byte[] buffer = new byte[8192];
                    long bytesSoFar = 0;
                    int lastProgressEmit = 0;
                    int n;

                    while ((n = in.read(buffer)) != -1) {
                        out.write(buffer, 0, n);
                        bytesSoFar += n;

                        // Emit progress every 5% or every 1MB
                        int pct = totalBytes > 0 ? (int) (bytesSoFar * 100 / totalBytes) : 0;
                        if (pct >= lastProgressEmit + 5 || bytesSoFar - (lastProgressEmit > 0 ? (long) lastProgressEmit * totalBytes / 100 : 0) > 1_000_000) {
                            lastProgressEmit = pct;
                            JSObject progress = new JSObject();
                            progress.put("status", "downloading");
                            progress.put("loaded", bytesSoFar);
                            progress.put("total", totalBytes);
                            progress.put("percent", pct);
                            notifyListeners("downloadProgress", progress);
                        }
                    }

                    Log.i(TAG, "Downloaded " + bytesSoFar + " bytes to " + outputFile.getAbsolutePath());
                }
                return; // Success

            } finally {
                conn.disconnect();
            }
        }

        throw new Exception("Too many redirects (" + redirectCount + ")");
    }

    /**
     * Trigger the Android package installer for a downloaded APK file.
     */
    private void installFromFile(File apkFile, PluginCall call) {
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
                JSObject result = new JSObject();
                result.put("installed", true);
                result.put("path", apkFile.getAbsolutePath());
                call.resolve(result);
            } else {
                // Fallback: try ACTION_VIEW with APK mime type
                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(viewIntent);
                JSObject result = new JSObject();
                result.put("installed", true);
                result.put("path", apkFile.getAbsolutePath());
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage());
        }
    }
}
