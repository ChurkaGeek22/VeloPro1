package com.velopro;

import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import android.app.Activity;

public class MainActivity extends Activity {

    private WebView webView;
    private LinearLayout progressContainer;
    private TextView progressPercentage;
    private ProgressBar circularProgressBar;
    private LinearLayout offlineContainer;
    private LinearLayout firstRunContainer;
    private EditText etFirstRunUrl;
    private Button btnFirstRunSave;
    private Button btnRetryConnection;
    private Button btnOfflineSettings;
    private Button btnBack;
    private Button btnRefresh;
    private Button btnSettings;
    private LinearLayout floatingNavBar;

    private static final String DEFAULT_SITE_URL = "http://localhost:3000";
    private static final String PREFS_NAME = "velopro_prefs";
    private static final String KEY_START_URL = "start_url";
    private static final String KEY_CACHE_ENABLED = "cache_enabled";
    private static final String KEY_DEVICE_ID = "device_id";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_SESSION_TOKEN = "session_token";

    private String deviceId;
    private String userId;
    private String sessionToken;
    private String currentTargetUrl = "";
    private boolean isOfflineError = false;
    private SharedPreferences prefs;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        makeFullscreen();
        setContentView(R.layout.activity_main);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        loadLocalIdentifiers();
        initViews();
        setupListeners();
        setupWebView();

        // Проверка первого входа
        String savedUrl = prefs.getString(KEY_START_URL, null);
        if (savedUrl == null || savedUrl.trim().isEmpty()) {
            showFirstRunSetup();
        } else {
            currentTargetUrl = savedUrl;
            loadConfiguredUrl(savedUrl);
        }
    }

    /**
     * Полноэкранный режим без статус бара ОС
     */
    private void makeFullscreen() {
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        );
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            makeFullscreen();
        }
    }

    private void initViews() {
        webView = findViewById(R.id.webView);
        progressContainer = findViewById(R.id.progressContainer);
        progressPercentage = findViewById(R.id.progressPercentage);
        circularProgressBar = findViewById(R.id.circularProgressBar);
        offlineContainer = findViewById(R.id.offlineContainer);
        firstRunContainer = findViewById(R.id.firstRunContainer);
        etFirstRunUrl = findViewById(R.id.etFirstRunUrl);
        btnFirstRunSave = findViewById(R.id.btnFirstRunSave);
        btnRetryConnection = findViewById(R.id.btnRetryConnection);
        btnOfflineSettings = findViewById(R.id.btnOfflineSettings);
        btnBack = findViewById(R.id.btnBack);
        btnRefresh = findViewById(R.id.btnRefresh) ;
        btnSettings = findViewById(R.id.btnSettings);
        floatingNavBar = findViewById(R.id.floatingNavBar);
    }

    private void setupListeners() {
        // Кнопка Назад для навигации внутри WebView
        btnBack.setOnClickListener(v -> {
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
            } else {
                Toast.makeText(this, "Вы на начальной странице", Toast.LENGTH_SHORT).show();
            }
        });

        btnRefresh.setOnClickListener(v -> {
            if (!isNetworkConnected()) {
                showOfflineScreen();
            } else {
                hideOfflineScreen();
                if (webView != null) webView.reload();
            }
        });

        btnSettings.setOnClickListener(v -> showSettingsDialog());
        btnOfflineSettings.setOnClickListener(v -> showSettingsDialog());

        // Кнопка повторной попытки на экране Нет интернета
        btnRetryConnection.setOnClickListener(v -> {
            if (isNetworkConnected()) {
                hideOfflineScreen();
                if (currentTargetUrl != null && !currentTargetUrl.isEmpty()) {
                    loadConfiguredUrl(currentTargetUrl);
                } else {
                    if (webView != null) webView.reload();
                }
            } else {
                Toast.makeText(this, "Сеть всё ещё недоступна", Toast.LENGTH_SHORT).show();
            }
        });

        btnFirstRunSave.setOnClickListener(v -> {
            String inputUrl = etFirstRunUrl.getText().toString().trim();
            String sanitized = sanitizeUrl(inputUrl);
            if (!sanitized.isEmpty()) {
                prefs.edit().putString(KEY_START_URL, sanitized).apply();
                currentTargetUrl = sanitized;
                firstRunContainer.setVisibility(View.GONE);
                webView.setVisibility(View.VISIBLE);
                floatingNavBar.setVisibility(View.VISIBLE);
                loadConfiguredUrl(sanitized);
            } else {
                Toast.makeText(this, getString(R.string.invalid_url_msg), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webSettings.setUserAgentString("VeloPro/1.0.1 (Android; WebView)");
        webSettings.setUseWideViewPort(true);
        webSettings.setLoadWithOverviewMode(true);
        webSettings.setBuiltInZoomControls(true);
        webSettings.setDisplayZoomControls(false);

        applyCacheSettings();

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Индикатор загрузки в виде круглешка и процентов
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (progressPercentage != null) {
                    progressPercentage.setText(newProgress + "%");
                }
                if (newProgress > 0 && newProgress < 100) {
                    if (!isOfflineError && progressContainer != null) {
                        progressContainer.setVisibility(View.VISIBLE);
                    }
                } else if (newProgress >= 100) {
                    if (progressContainer != null) {
                        progressContainer.setVisibility(View.GONE);
                    }
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return false;
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                isOfflineError = false;
                updateBackBtnState();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (progressContainer != null) {
                    progressContainer.setVisibility(View.GONE);
                }
                updateBackBtnState();
                if (!isOfflineError) {
                    hideOfflineScreen();
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.proceed();
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                if (errorCode == ERROR_HOST_LOOKUP || errorCode == ERROR_CONNECT || errorCode == ERROR_TIMEOUT) {
                    isOfflineError = true;
                    showOfflineScreen();
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    isOfflineError = true;
                    showOfflineScreen();
                }
            }
        });

        webView.addJavascriptInterface(new AndroidBridge(this), "Android");
    }

    private void applyCacheSettings() {
        boolean cacheEnabled = prefs.getBoolean(KEY_CACHE_ENABLED, true);
        if (!cacheEnabled) {
            webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        } else {
            if (isNetworkConnected()) {
                webView.getSettings().setCacheMode(WebSettings.LOAD_DEFAULT);
            } else {
                webView.getSettings().setCacheMode(WebSettings.LOAD_CACHE_ELSE_NETWORK);
            }
        }
    }

    private void loadConfiguredUrl(String url) {
        if (!isNetworkConnected()) {
            boolean cacheEnabled = prefs.getBoolean(KEY_CACHE_ENABLED, true);
            if (!cacheEnabled) {
                showOfflineScreen();
                return;
            }
        }
        hideOfflineScreen();
        firstRunContainer.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
        floatingNavBar.setVisibility(View.VISIBLE);
        applyCacheSettings();
        webView.loadUrl(url);
    }

    private void showFirstRunSetup() {
        firstRunContainer.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
        floatingNavBar.setVisibility(View.GONE);
        offlineContainer.setVisibility(View.GONE);
        progressContainer.setVisibility(View.GONE);
        etFirstRunUrl.setText(DEFAULT_SITE_URL);
        etFirstRunUrl.setSelection(etFirstRunUrl.getText().length());
    }

    private void showOfflineScreen() {
        offlineContainer.setVisibility(View.VISIBLE);
        webView.setVisibility(View.GONE);
        progressContainer.setVisibility(View.GONE);
        floatingNavBar.setVisibility(View.VISIBLE);
    }

    private void hideOfflineScreen() {
        offlineContainer.setVisibility(View.GONE);
        webView.setVisibility(View.VISIBLE);
    }

    private void updateBackBtnState() {
        if (btnBack != null && webView != null) {
            btnBack.setAlpha(webView.canGoBack() ? 1.0f : 0.5f);
        }
    }

    private boolean isNetworkConnected() {
        ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return false;
        Network activeNetwork = cm.getActiveNetwork();
        if (activeNetwork == null) return false;
        NetworkCapabilities capabilities = cm.getNetworkCapabilities(activeNetwork);
        return capabilities != null && capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    private String sanitizeUrl(String input) {
        if (input == null) return "";
        String url = input.trim();
        if (url.isEmpty()) return "";
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://" + url;
        }
        return url;
    }

    private void showSettingsDialog() {
        LinearLayout dialogLayout = new LinearLayout(this);
        dialogLayout.setOrientation(LinearLayout.VERTICAL);
        dialogLayout.setPadding(48, 32, 48, 16);

        TextView tvUrl = new TextView(this);
        tvUrl.setText(getString(R.string.settings_url_label));
        tvUrl.setTextSize(14f);
        tvUrl.setTextColor(0xFF004D40);

        final EditText etUrl = new EditText(this);
        etUrl.setText(currentTargetUrl != null ? currentTargetUrl : DEFAULT_SITE_URL);
        etUrl.setSelection(etUrl.getText().length());

        final CheckBox cbCache = new CheckBox(this);
        cbCache.setText(getString(R.string.settings_cache_label));
        cbCache.setChecked(prefs.getBoolean(KEY_CACHE_ENABLED, true));
        cbCache.setTextColor(0xFF004D40);

        Button btnClearCache = new Button(this);
        btnClearCache.setText(getString(R.string.btn_clear_cache));
        btnClearCache.setBackgroundColor(0xFFE0E0E0);
        btnClearCache.setTextColor(0xFF004D40);
        btnClearCache.setOnClickListener(v -> {
            if (webView != null) webView.clearCache(true);
            CookieManager.getInstance().removeAllCookies(null);
            CookieManager.getInstance().flush();
            Toast.makeText(MainActivity.this, getString(R.string.cache_cleared_msg), Toast.LENGTH_SHORT).show();
        });

        dialogLayout.addView(tvUrl);
        dialogLayout.addView(etUrl);
        dialogLayout.addView(cbCache);
        dialogLayout.addView(btnClearCache);

        new AlertDialog.Builder(this)
            .setTitle(getString(R.string.settings_title))
            .setView(dialogLayout)
            .setPositiveButton("Применить", (dialog, which) -> {
                String newUrl = sanitizeUrl(etUrl.getText().toString());
                boolean cacheChecked = cbCache.isChecked();
                if (!newUrl.isEmpty()) {
                    prefs.edit()
                        .putString(KEY_START_URL, newUrl)
                        .putBoolean(KEY_CACHE_ENABLED, cacheChecked)
                        .apply();
                    currentTargetUrl = newUrl;
                    applyCacheSettings();
                    loadConfiguredUrl(newUrl);
                    Toast.makeText(MainActivity.this, "Настройки сохранены", Toast.LENGTH_SHORT).show();
                } else {
                    Toast.makeText(MainActivity.this, getString(R.string.invalid_url_msg), Toast.LENGTH_SHORT).show();
                }
            })
            .setNegativeButton("Отмена", null)
            .show();
    }

    private void loadLocalIdentifiers() {
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
        prefs.edit().putString(KEY_USER_ID, userId).apply();
    }

    public void saveSessionToken(String token) {
        this.sessionToken = token;
        prefs.edit().putString(KEY_SESSION_TOKEN, token).apply();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (firstRunContainer != null && firstRunContainer.getVisibility() == View.VISIBLE) {
            return super.onKeyDown(keyCode, event);
        }
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
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
