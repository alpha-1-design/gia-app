package com.alpha1studio.gia;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.ContentUris;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.provider.MediaStore;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public class GIAMediaService extends Service implements MediaPlayer.OnCompletionListener,
        MediaPlayer.OnErrorListener, MediaPlayer.OnPreparedListener, AudioManager.OnAudioFocusChangeListener {

    private static final String TAG = "GIAMediaService";
    private static final String CHANNEL_ID = "gia_media_playback";
    private static final int NOTIFICATION_ID = 1001;

    private MediaPlayer mediaPlayer;
    private MediaSession mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private boolean isPrepared = false;
    private boolean isPaused = false;
    private int resumePosition = 0;

    private String currentTitle = "";
    private String currentArtist = "";
    private String currentPath = "";
    private long currentAlbumId = -1;
    private int currentDuration = 0;

    private static boolean isRunning = false;
    private static GIAMediaService instance = null;

    public static boolean isRunning() { return isRunning; }
    public static GIAMediaService getInstance() { return instance; }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        isRunning = true;
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        createNotificationChannel();
        setupMediaSession();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;

        String action = intent.getAction();
        if (action == null) return START_STICKY;

        switch (action) {
            case "PLAY":
                String path = intent.getStringExtra("path");
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                long albumId = intent.getLongExtra("albumId", -1);
                play(path, title, artist, albumId);
                break;
            case "PLAY_URI":
                String uri = intent.getStringExtra("uri");
                playUri(uri);
                break;
            case "PAUSE":
                pause();
                break;
            case "RESUME":
                resume();
                break;
            case "STOP":
                stop();
                break;
            case "SEEK_TO":
                int pos = intent.getIntExtra("position", 0);
                seekTo(pos);
                break;
            case "TOGGLE":
                if (mediaPlayer != null && mediaPlayer.isPlaying()) pause();
                else resume();
                break;
        }

        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        isRunning = false;
        instance = null;
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            mediaPlayer.release();
            mediaPlayer = null;
        }
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        if (audioManager != null && audioFocusRequest != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
            }
        }
        stopForeground(true);
        super.onDestroy();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Media Playback",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Controls for GIA media playback");
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void setupMediaSession() {
        mediaSession = new MediaSession(this, TAG);
        mediaSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);

        Intent intent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        mediaSession.setSessionActivity(pi);

        mediaSession.setCallback(new MediaSession.Callback() {
            @Override
            public void onPlay() { resume(); }
            @Override
            public void onPause() { pause(); }
            @Override
            public void onStop() { stop(); }
            @Override
            public void onSeekTo(long pos) { seekTo((int) pos); }
            @Override
            public void onSkipToNext() { playNext(); }
            @Override
            public void onSkipToPrevious() { playPrevious(); }
        });

        updatePlaybackState(PlaybackState.STATE_NONE);
    }

    private void updatePlaybackState(int state) {
        if (mediaSession == null) return;
        PlaybackState.Builder builder = new PlaybackState.Builder()
                .setActions(
                        PlaybackState.ACTION_PLAY |
                        PlaybackState.ACTION_PAUSE |
                        PlaybackState.ACTION_STOP |
                        PlaybackState.ACTION_SEEK_TO |
                        PlaybackState.ACTION_SKIP_TO_NEXT |
                        PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                        PlaybackState.ACTION_PLAY_PAUSE
                )
                .setState(state, state == PlaybackState.STATE_PLAYING && mediaPlayer != null ?
                        mediaPlayer.getCurrentPosition() : resumePosition, 1.0f);
        mediaSession.setPlaybackState(builder.build());

        if (state == PlaybackState.STATE_PLAYING) {
            startForeground(NOTIFICATION_ID, buildNotification());
        }
    }

    @SuppressWarnings("deprecation")
    private void updateMediaMetadata() {
        if (mediaSession == null || currentPath == null) return;
        MediaMetadata.Builder builder = new MediaMetadata.Builder();
        if (currentTitle != null) builder.putString(MediaMetadata.METADATA_KEY_TITLE, currentTitle);
        if (currentArtist != null) builder.putString(MediaMetadata.METADATA_KEY_ARTIST, currentArtist);
        builder.putLong(MediaMetadata.METADATA_KEY_DURATION, currentDuration);
        if (currentAlbumId > 0) {
            Uri artworkUri = ContentUris.withAppendedId(
                    Uri.parse("content://media/external/audio/albumart"), currentAlbumId);
            builder.putString(MediaMetadata.METADATA_KEY_ART_URI, artworkUri.toString());
        }
        mediaSession.setMetadata(builder.build());
    }

    private Notification buildNotification() {
        Intent prevIntent = new Intent(this, GIAMediaService.class).setAction("PREVIOUS");
        Intent playPauseIntent = new Intent(this, GIAMediaService.class)
                .setAction(mediaPlayer != null && mediaPlayer.isPlaying() ? "PAUSE" : "RESUME");
        Intent nextIntent = new Intent(this, GIAMediaService.class).setAction("NEXT");
        Intent stopIntent = new Intent(this, GIAMediaService.class).setAction("STOP");

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(currentTitle != null ? currentTitle : "GIA Music")
                .setContentText(currentArtist != null ? currentArtist : "Playing")
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setOngoing(true)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setStyle(new androidx.media.app.NotificationCompat.MediaStyle()
                        .setMediaSession(mediaSession.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2))
                .addAction(android.R.drawable.ic_media_previous, "Previous",
                        PendingIntent.getService(this, 1, prevIntent, flags))
                .addAction(mediaPlayer != null && mediaPlayer.isPlaying() ?
                                android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        mediaPlayer != null && mediaPlayer.isPlaying() ? "Pause" : "Play",
                        PendingIntent.getService(this, 2, playPauseIntent, flags))
                .addAction(android.R.drawable.ic_media_next, "Next",
                        PendingIntent.getService(this, 3, nextIntent, flags))
                .setDeleteIntent(PendingIntent.getService(this, 4, stopIntent, flags));

        return builder.build();
    }

    private boolean requestAudioFocus() {
        if (audioManager == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build();
            audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(attrs)
                    .setOnAudioFocusChangeListener(this)
                    .build();
            int result = audioManager.requestAudioFocus(audioFocusRequest);
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } else {
            int result = audioManager.requestAudioFocus(this, AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN);
            return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        }
    }

    @Override
    public void onAudioFocusChange(int focusChange) {
        switch (focusChange) {
            case AudioManager.AUDIOFOCUS_LOSS:
                pause();
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                if (mediaPlayer != null && mediaPlayer.isPlaying()) {
                    resumePosition = mediaPlayer.getCurrentPosition();
                    pause();
                }
                break;
            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                if (mediaPlayer != null) mediaPlayer.setVolume(0.3f, 0.3f);
                break;
            case AudioManager.AUDIOFOCUS_GAIN:
                if (mediaPlayer != null) mediaPlayer.setVolume(1.0f, 1.0f);
                break;
        }
    }

    public void play(String path, String title, String artist, long albumId) {
        if (!requestAudioFocus() && mediaPlayer != null && mediaPlayer.isPlaying()) return;

        currentPath = path;
        currentTitle = title != null ? title : "Unknown";
        currentArtist = artist != null ? artist : "Unknown";
        currentAlbumId = albumId;

        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.reset();
            } else {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setOnCompletionListener(this);
                mediaPlayer.setOnErrorListener(this);
                mediaPlayer.setOnPreparedListener(this);
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build());
            }

            Uri uri = Uri.parse(path);
            mediaPlayer.setDataSource(this, uri);
            mediaPlayer.prepareAsync();
            isPrepared = false;
            isPaused = false;
            updatePlaybackState(PlaybackState.STATE_BUFFERING);
        } catch (IOException e) {
            Log.e(TAG, "Failed to play: " + path, e);
            updatePlaybackState(PlaybackState.STATE_ERROR);
        }
    }

    public void playUri(String uri) {
        currentTitle = uri.substring(uri.lastIndexOf('/') + 1);
        currentArtist = "GIA";
        currentAlbumId = -1;

        try {
            if (mediaPlayer != null) {
                if (mediaPlayer.isPlaying()) mediaPlayer.stop();
                mediaPlayer.reset();
            } else {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setOnCompletionListener(this);
                mediaPlayer.setOnErrorListener(this);
                mediaPlayer.setOnPreparedListener(this);
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build());
            }

            if (!requestAudioFocus()) return;
            mediaPlayer.setDataSource(uri);
            mediaPlayer.prepareAsync();
            isPrepared = false;
            isPaused = false;
            updatePlaybackState(PlaybackState.STATE_BUFFERING);
        } catch (IOException e) {
            Log.e(TAG, "Failed to play URI: " + uri, e);
            updatePlaybackState(PlaybackState.STATE_ERROR);
        }
    }

    @Override
    public void onPrepared(MediaPlayer mp) {
        isPrepared = true;
        currentDuration = mp.getDuration();
        mp.start();
        isPaused = false;
        updateMediaMetadata();
        updatePlaybackState(PlaybackState.STATE_PLAYING);
    }

    public void pause() {
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            mediaPlayer.pause();
            resumePosition = mediaPlayer.getCurrentPosition();
            isPaused = true;
            updatePlaybackState(PlaybackState.STATE_PAUSED);
        }
    }

    public void resume() {
        if (mediaPlayer != null && isPaused) {
            if (!requestAudioFocus()) return;
            mediaPlayer.seekTo(resumePosition);
            mediaPlayer.start();
            isPaused = false;
            updatePlaybackState(PlaybackState.STATE_PLAYING);
        }
    }

    public void stop() {
        if (mediaPlayer != null) {
            if (mediaPlayer.isPlaying()) mediaPlayer.stop();
            mediaPlayer.reset();
        }
        isPrepared = false;
        isPaused = false;
        resumePosition = 0;
        updatePlaybackState(PlaybackState.STATE_STOPPED);
        stopForeground(false);
        stopSelf();
    }

    public void seekTo(int position) {
        if (mediaPlayer != null && isPrepared) {
            mediaPlayer.seekTo(position);
            resumePosition = position;
        }
    }

    public int getCurrentPosition() {
        if (mediaPlayer != null && isPrepared) {
            return mediaPlayer.getCurrentPosition();
        }
        return resumePosition;
    }

    public boolean isPlaying() {
        return mediaPlayer != null && mediaPlayer.isPlaying();
    }

    public int getDuration() {
        return currentDuration;
    }

    private SongInfo currentSongInfo = null;
    private List<SongInfo> currentQueue = new ArrayList<>();
    private int currentQueueIndex = -1;

    public void playWithQueue(String path, String title, String artist, long albumId, List<SongInfo> queue, int index) {
        currentQueue = queue != null ? queue : new ArrayList<>();
        currentQueueIndex = index;
        play(path, title, artist, albumId);
    }

    public void playNext() {
        if (currentQueue.isEmpty() || currentQueueIndex < 0) return;
        int nextIndex = (currentQueueIndex + 1) % currentQueue.size();
        if (nextIndex == currentQueueIndex) return;
        SongInfo next = currentQueue.get(nextIndex);
        currentQueueIndex = nextIndex;
        play(next.path, next.title, next.artist, next.albumId);
    }

    public void playPrevious() {
        if (currentQueue.isEmpty() || currentQueueIndex < 0) return;
        int prevIndex = (currentQueueIndex - 1 + currentQueue.size()) % currentQueue.size();
        if (prevIndex == currentQueueIndex) return;
        SongInfo prev = currentQueue.get(prevIndex);
        currentQueueIndex = prevIndex;
        play(prev.path, prev.title, prev.artist, prev.albumId);
    }

    @Override
    public void onCompletion(MediaPlayer mp) {
        playNext();
    }

    @Override
    public boolean onError(MediaPlayer mp, int what, int extra) {
        Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
        updatePlaybackState(PlaybackState.STATE_ERROR);
        return true;
    }

    public static class SongInfo {
        public String path;
        public String title;
        public String artist;
        public long albumId;
        public long duration;
        public String album;

        public SongInfo(String path, String title, String artist, long albumId, long duration, String album) {
            this.path = path;
            this.title = title;
            this.artist = artist;
            this.albumId = albumId;
            this.duration = duration;
            this.album = album;
        }
    }

    public static List<SongInfo> queryMediaStore(android.content.Context context) {
        List<SongInfo> songs = new ArrayList<>();
        Uri collection;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL);
        } else {
            collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        }

        String[] projection = {
                MediaStore.Audio.Media._ID,
                MediaStore.Audio.Media.TITLE,
                MediaStore.Audio.Media.ARTIST,
                MediaStore.Audio.Media.ALBUM_ID,
                MediaStore.Audio.Media.ALBUM,
                MediaStore.Audio.Media.DURATION,
                MediaStore.Audio.Media.DATA,
                MediaStore.Audio.Media.SIZE,
        };

        String selection = MediaStore.Audio.Media.IS_MUSIC + " != 0 AND " +
                MediaStore.Audio.Media.DURATION + " > 10000 AND " +
                MediaStore.Audio.Media.SIZE + " > 10000";

        try (Cursor cursor = context.getContentResolver().query(
                collection, projection, selection, null,
                MediaStore.Audio.Media.TITLE + " ASC")) {
            if (cursor != null && cursor.moveToFirst()) {
                do {
                    String path = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA));
                    String title = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE));
                    String artist = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST));
                    long albumId = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM_ID));
                    long duration = cursor.getLong(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION));
                    String album = cursor.getString(cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM));
                    songs.add(new SongInfo(path, title, artist, albumId, duration, album));
                } while (cursor.moveToNext());
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to query MediaStore", e);
        }
        return songs;
    }
}
