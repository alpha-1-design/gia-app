package com.alpha1studio.gia;

import android.content.Intent;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.List;

@CapacitorPlugin(name = "GIAMedia")
public class GIAMediaPlugin extends Plugin {

    private static final String TAG = "GIAMediaPlugin";

    @PluginMethod
    public void play(PluginCall call) {
        String path = call.getString("path");
        String title = call.getString("title", "Unknown");
        String artist = call.getString("artist", "Unknown");
        Long albumId = call.getLong("albumId", -1L);

        if (path == null || path.isEmpty()) {
            call.reject("path is required");
            return;
        }

        Intent intent = new Intent(getContext(), GIAMediaService.class);
        intent.setAction("PLAY");
        intent.putExtra("path", path);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("albumId", albumId);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void playUri(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.isEmpty()) {
            call.reject("uri is required");
            return;
        }

        Intent intent = new Intent(getContext(), GIAMediaService.class);
        intent.setAction("PLAY_URI");
        intent.putExtra("uri", uri);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Intent intent = new Intent(getContext(), GIAMediaService.class);
        intent.setAction("PAUSE");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        Intent intent = new Intent(getContext(), GIAMediaService.class);
        intent.setAction("RESUME");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), GIAMediaService.class);
        intent.setAction("STOP");
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        int position = call.getInt("position", 0);
        Intent intent = new Intent(getContext(), GIAMediaService.class);
        intent.setAction("SEEK_TO");
        intent.putExtra("position", position);
        getContext().startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        GIAMediaService service = GIAMediaService.getInstance();
        if (service != null) {
            ret.put("isPlaying", service.isPlaying());
            ret.put("currentPosition", service.getCurrentPosition());
            ret.put("duration", service.getDuration());
            ret.put("isRunning", true);
        } else {
            ret.put("isPlaying", false);
            ret.put("currentPosition", 0);
            ret.put("duration", 0);
            ret.put("isRunning", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void listSongs(PluginCall call) {
        try {
            List<GIAMediaService.SongInfo> songs = GIAMediaService.queryMediaStore(getContext());
            JSArray result = new JSArray();
            for (GIAMediaService.SongInfo song : songs) {
                JSObject obj = new JSObject();
                obj.put("path", song.path);
                obj.put("title", song.title);
                obj.put("artist", song.artist);
                obj.put("album", song.album != null ? song.album : "");
                obj.put("albumId", song.albumId);
                obj.put("duration", song.duration);
                result.put(obj);
            }
            JSObject ret = new JSObject();
            ret.put("songs", result);
            ret.put("count", songs.size());
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to list songs", e);
            call.reject("Failed to query media library: " + e.getMessage());
        }
    }

    @PluginMethod
    public void searchSongs(PluginCall call) {
        String query = call.getString("query", "");
        try {
            List<GIAMediaService.SongInfo> songs = GIAMediaService.queryMediaStore(getContext());
            JSArray result = new JSArray();
            String lowerQuery = query.toLowerCase();
            for (GIAMediaService.SongInfo song : songs) {
                boolean matches = song.title.toLowerCase().contains(lowerQuery) ||
                        song.artist.toLowerCase().contains(lowerQuery) ||
                        (song.album != null && song.album.toLowerCase().contains(lowerQuery));
                if (matches) {
                    JSObject obj = new JSObject();
                    obj.put("path", song.path);
                    obj.put("title", song.title);
                    obj.put("artist", song.artist);
                    obj.put("album", song.album != null ? song.album : "");
                    obj.put("albumId", song.albumId);
                    obj.put("duration", song.duration);
                    result.put(obj);
                }
            }
            JSObject ret = new JSObject();
            ret.put("songs", result);
            ret.put("count", result.length());
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to search songs", e);
            call.reject("Failed to search media library: " + e.getMessage());
        }
    }
}
