package com.sona.app;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class MediaListenerService extends NotificationListenerService {

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        // No need to do anything here
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // No need to do anything here
    }
}