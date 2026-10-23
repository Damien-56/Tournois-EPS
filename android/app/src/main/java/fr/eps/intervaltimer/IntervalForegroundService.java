package fr.eps.intervaltimer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class IntervalForegroundService extends Service {
    static final String EXTRA_TITLE = "title";
    static final String EXTRA_INTERVAL = "interval";
    static final String EXTRA_REMAINING = "remainingSeconds";
    private static final String CHANNEL_ID = "eps_interval_timer";
    private static final int NOTIFICATION_ID = 2401;

    @Override public void onCreate() {
        super.onCreate();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Minuteur EPS", NotificationManager.IMPORTANCE_LOW));
        }
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String title = intent == null ? "Intervalle EPS" : intent.getStringExtra(EXTRA_TITLE);
        String interval = intent == null ? "Séance EPS" : intent.getStringExtra(EXTRA_INTERVAL);
        int remaining = intent == null ? 0 : intent.getIntExtra(EXTRA_REMAINING, 0);
        startForeground(NOTIFICATION_ID, notification(title, interval, remaining));
        return START_STICKY;
    }

    private Notification notification(String title, String interval, int remaining) {
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title == null ? "Intervalle EPS" : title)
            .setContentText((interval == null ? "Séance EPS" : interval) + " · " + remaining + " s")
            .setContentIntent(pending)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }
}
