package com.velopro;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;

import androidx.annotation.Nullable;

public class PushService extends Service {

    private static final String TAG = "PushService";

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "PushService created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "PushService started");
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case "com.velopro.PUSH_NOTIFICATION":
                    handlePushNotification(intent);
                    break;
            }
        }
        return START_STICKY;
    }

    private void handlePushNotification(Intent intent) {
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String data = intent.getStringExtra("data");
        Log.d(TAG, "Push notification: " + title + " - " + body);
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "PushService destroyed");
    }
}