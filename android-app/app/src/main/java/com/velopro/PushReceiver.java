package com.velopro;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class PushReceiver extends BroadcastReceiver {

    private static final String TAG = "PushReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "PushReceiver received intent");
        if (intent != null && "com.velopro.PUSH_NOTIFICATION".equals(intent.getAction())) {
            Intent serviceIntent = new Intent(context, PushService.class);
            serviceIntent.setAction("com.velopro.PUSH_NOTIFICATION");
            serviceIntent.putExtra("title", intent.getStringExtra("title"));
            serviceIntent.putExtra("body", intent.getStringExtra("body"));
            serviceIntent.putExtra("data", intent.getStringExtra("data"));
            context.startService(serviceIntent);
        }
    }
}