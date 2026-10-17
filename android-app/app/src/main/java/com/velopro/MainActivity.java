package com.velopro;

import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.http.SslError;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private static final String SITE_URL = "http://localhost:3000";
    private static final String PREFS_NAME = "velopro_prefs";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_SESSION_TOKEN = "session_token";

    private String deviceId;
    private String userId;
    private String sessionToken;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        loadLocalIdentifiers();

        webView = findViewById(R.id.webView);
        setupWebView();

        webView.loadUrl(SITE_URL);
    }

    private void loadLocalIdentifiers() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        deviceId = prefs.getString(KEY_DEVICE_ID, null);
        userId = prefs.getString(KEY_USER_ID, null);
        sessionToken = prefs.getString(KEY_SESSION_TOKEN, null);

        if (deviceId == null) {
            deviceId = generateDeviceId();
            prefs.edit().putString(KEY_DEVICE_ID, deviceId).apply();
        }
    }

    private String generateDeviceId() {
        return "dev_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 10000);
    }

    public String getAppDeviceId() {
        return deviceId;
    }

    public String getUserId() {
        return userId;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public void saveUserId(String userId) {
        this.userId = userId;
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_USER_ID, userId).apply();
    }

    public void saveSessionToken(String token) {
        this.sessionToken = token;
        getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_SESSION_TOKEN, token).apply();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webSettings.setUserAgentString("VeloPro/1.0.1 (Android; WebView)");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(this), "Android");
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.destroy();
        }
    }

    public static class AndroidBridge {
        private final MainActivity activity;

        public AndroidBridge(MainActivity activity) {
            this.activity = activity;
        }

        @android.webkit.JavascriptInterface
        public String getDeviceId() {
            return activity.getAppDeviceId();
        }

        @android.webkit.JavascriptInterface
        public String getUserId() {
            return activity.getUserId();
        }

        @android.webkit.JavascriptInterface
        public String getSessionToken() {
            return activity.getSessionToken();
        }

        @android.webkit.JavascriptInterface
        public void saveUserId(String userId) {
            activity.saveUserId(userId);
        }

        @android.webkit.JavascriptInterface
        public void saveSessionToken(String token) {
            activity.saveSessionToken(token);
        }

        @android.webkit.JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(activity, message, Toast.LENGTH_SHORT).show();
        }
    }
}