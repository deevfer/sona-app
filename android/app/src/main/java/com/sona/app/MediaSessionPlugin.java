package com.sona.app;

import android.content.ComponentName;
import android.content.Context;
import android.media.MediaMetadata;
import android.media.session.MediaController;
import android.media.session.MediaSessionManager;
import android.media.session.PlaybackState;
import android.graphics.Bitmap;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.List;

@CapacitorPlugin(name = "MediaSessionPlugin")
public class MediaSessionPlugin extends Plugin {

    private MediaController getActiveController() {
        try {
            Context context = getContext();
            MediaSessionManager msm = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
            ComponentName cn = new ComponentName(context, MediaListenerService.class);
            List<MediaController> controllers = msm.getActiveSessions(cn);

            if (controllers != null && !controllers.isEmpty()) {
                return controllers.get(0);
            }
        } catch (Exception e) {
            // No permission or no active sessions
        }
        return null;
    }

    @PluginMethod()
    public void getNowPlaying(PluginCall call) {
        MediaController controller = getActiveController();

        if (controller == null) {
            call.resolve(new JSObject());
            return;
        }

        JSObject result = new JSObject();

        // Playback state
        PlaybackState state = controller.getPlaybackState();
        boolean isPlaying = state != null && state.getState() == PlaybackState.STATE_PLAYING;
        long position = state != null ? state.getPosition() : 0;

        result.put("is_playing", isPlaying);
        result.put("progress_ms", position);

        // Metadata
        MediaMetadata metadata = controller.getMetadata();
        if (metadata != null) {
            JSObject track = new JSObject();
            track.put("name", metadata.getString(MediaMetadata.METADATA_KEY_TITLE));
            track.put("artist", metadata.getString(MediaMetadata.METADATA_KEY_ARTIST));
            track.put("album", metadata.getString(MediaMetadata.METADATA_KEY_ALBUM));
            track.put("duration_ms", metadata.getLong(MediaMetadata.METADATA_KEY_DURATION));

            // Cover art
            Bitmap bitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART);
            if (bitmap == null) {
                bitmap = metadata.getBitmap(MediaMetadata.METADATA_KEY_ART);
            }
            if (bitmap != null) {
                int maxSize = 300;
                if (bitmap.getWidth() > maxSize || bitmap.getHeight() > maxSize) {
                    float scale = Math.min((float) maxSize / bitmap.getWidth(), (float) maxSize / bitmap.getHeight());
                    int newW = Math.round(bitmap.getWidth() * scale);
                    int newH = Math.round(bitmap.getHeight() * scale);
                    bitmap = Bitmap.createScaledBitmap(bitmap, newW, newH, true);
                }
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 60, baos);
                String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);
                track.put("image", "data:image/jpeg;base64," + base64);
            }

            result.put("track", track);
        }
        if (controller.getPackageName() != null) {
            result.put("packageName", controller.getPackageName());
        }

        call.resolve(result);
    }

    @PluginMethod()
    public void play(PluginCall call) {
        MediaController controller = getActiveController();
        if (controller != null) {
            controller.getTransportControls().play();
        }
        call.resolve();
    }

    @PluginMethod()
    public void pause(PluginCall call) {
        MediaController controller = getActiveController();
        if (controller != null) {
            controller.getTransportControls().pause();
        }
        call.resolve();
    }

    @PluginMethod()
    public void next(PluginCall call) {
        MediaController controller = getActiveController();
        if (controller != null) {
            controller.getTransportControls().skipToNext();
        }
        call.resolve();
    }

    @PluginMethod()
    public void previous(PluginCall call) {
        MediaController controller = getActiveController();
        if (controller != null) {
            controller.getTransportControls().skipToPrevious();
        }
        call.resolve();
    }

    @PluginMethod()
    public void hasPermission(PluginCall call) {
        try {
            Context context = getContext();
            MediaSessionManager msm = (MediaSessionManager) context.getSystemService(Context.MEDIA_SESSION_SERVICE);
            ComponentName cn = new ComponentName(context, MediaListenerService.class);
            msm.getActiveSessions(cn);
            call.resolve(new JSObject().put("granted", true));
        } catch (SecurityException e) {
            call.resolve(new JSObject().put("granted", false));
        }
    }

    @PluginMethod()
    public void requestPermission(PluginCall call) {
        try {
            android.content.Intent intent = new android.content.Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS");
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings");
        }
    }

    @PluginMethod()
        public void getAppIcon(PluginCall call) {
            String packageName = call.getString("packageName");
            if (packageName == null) {
                call.resolve(new JSObject());
                return;
            }

            try {
                android.graphics.drawable.Drawable icon = getContext().getPackageManager().getApplicationIcon(packageName);
                Bitmap bitmap;

                if (icon instanceof android.graphics.drawable.BitmapDrawable) {
                    bitmap = ((android.graphics.drawable.BitmapDrawable) icon).getBitmap();
                } else {
                    bitmap = Bitmap.createBitmap(icon.getIntrinsicWidth(), icon.getIntrinsicHeight(), Bitmap.Config.ARGB_8888);
                    android.graphics.Canvas canvas = new android.graphics.Canvas(bitmap);
                    icon.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
                    icon.draw(canvas);
                }

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, baos);
                String base64 = Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP);

                JSObject result = new JSObject();
                result.put("icon", "data:image/png;base64," + base64);
                call.resolve(result);
            } catch (Exception e) {
                call.resolve(new JSObject());
            }
        }
    @PluginMethod()
        public void openApp(PluginCall call) {
            String packageName = call.getString("packageName");
            if (packageName == null) {
                call.reject("No package name");
                return;
            }

            try {
                android.content.Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
                if (intent != null) {
                    getActivity().startActivity(intent);
                    call.resolve();
                } else {
                    call.reject("App not found");
                }
            } catch (Exception e) {
                call.reject("Could not open app");
            }
        }
    @PluginMethod()
        public void getAppName(PluginCall call) {
            String packageName = call.getString("packageName");
            if (packageName == null) {
                call.resolve(new JSObject().put("name", ""));
                return;
            }

            try {
                android.content.pm.ApplicationInfo info = getContext().getPackageManager().getApplicationInfo(packageName, 0);
                String name = getContext().getPackageManager().getApplicationLabel(info).toString();
                call.resolve(new JSObject().put("name", name));
            } catch (Exception e) {
                call.resolve(new JSObject().put("name", ""));
            }
        }
}