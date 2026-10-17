package com.velopro

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.http.SslError
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.*
import androidx.appcompat.app.AppCompatActivity

/**
 * MainActivity на Kotlin для Android 10+ (API 29+)
 * Полноэкранный режим без статус бара ОС, кэширование, круговой индикатор загрузки,
 * навигация Назад, экран Нет интернета с перечеркнутым красным облаком.
 */
class MainActivityKotlin : AppCompatActivity() {

    private lateinit var webView: WebView
    private var progressContainer: LinearLayout? = null
    private var progressPercentage: TextView? = null
    private var offlineContainer: LinearLayout? = null
    private var firstRunContainer: LinearLayout? = null
    private var etFirstRunUrl: EditText? = null
    private var btnFirstRunSave: Button? = null
    private var btnRetryConnection: Button? = null
    private var btnOfflineSettings: Button? = null
    private var btnBack: Button? = null
    private var btnRefresh: Button? = null
    private var btnSettings: Button? = null
    private var floatingNavBar: LinearLayout? = null

    private lateinit var prefs: SharedPreferences
    private var currentTargetUrl: String = ""
    private var isOfflineError: Boolean = false

    companion object {
        private const val DEFAULT_SITE_URL = "http://localhost:3000"
        private const val PREFS_NAME = "velopro_prefs"
        private const val KEY_START_URL = "start_url"
        private const val KEY_CACHE_ENABLED = "cache_enabled"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_SESSION_TOKEN = "session_token"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        makeFullscreen()
        setContentView(R.layout.activity_main)

        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

        initViews()
        setupListeners()
        setupWebView()

        val savedUrl = prefs.getString(KEY_START_URL, null)
        if (savedUrl.isNullOrEmpty()) {
            showFirstRunSetup()
        } else {
            currentTargetUrl = savedUrl
            loadConfiguredUrl(savedUrl)
        }
    }

    private fun makeFullscreen() {
        @Suppress("DEPRECATION")
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )
        @Suppress("DEPRECATION")
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN
            or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
            or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        )
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            makeFullscreen()
        }
    }

    private fun initViews() {
        webView = findViewById(R.id.webView)
        progressContainer = findViewById(R.id.progressContainer)
        progressPercentage = findViewById(R.id.progressPercentage)
        offlineContainer = findViewById(R.id.offlineContainer)
        firstRunContainer = findViewById(R.id.firstRunContainer)
        etFirstRunUrl = findViewById(R.id.etFirstRunUrl)
        btnFirstRunSave = findViewById(R.id.btnFirstRunSave)
        btnRetryConnection = findViewById(R.id.btnRetryConnection)
        btnOfflineSettings = findViewById(R.id.btnOfflineSettings)
        btnBack = findViewById(R.id.btnBack)
        btnRefresh = findViewById(R.id.btnRefresh)
        btnSettings = findViewById(R.id.btnSettings)
        floatingNavBar = findViewById(R.id.floatingNavBar)
    }

    private fun setupListeners() {
        btnBack?.setOnClickListener {
            if (webView.canGoBack()) {
                webView.goBack()
            } else {
                Toast.makeText(this, "Вы на начальной странице", Toast.LENGTH_SHORT).show()
            }
        }

        btnRefresh?.setOnClickListener {
            if (!isNetworkConnected()) {
                showOfflineScreen()
            } else {
                hideOfflineScreen()
                webView.reload()
            }
        }

        btnSettings?.setOnClickListener { showSettingsDialog() }
        btnOfflineSettings?.setOnClickListener { showSettingsDialog() }

        btnRetryConnection?.setOnClickListener {
            if (isNetworkConnected()) {
                hideOfflineScreen()
                if (currentTargetUrl.isNotEmpty()) {
                    loadConfiguredUrl(currentTargetUrl)
                } else {
                    webView.reload()
                }
            } else {
                Toast.makeText(this, "Сеть всё ещё недоступна", Toast.LENGTH_SHORT).show()
            }
        }

        btnFirstRunSave?.setOnClickListener {
            val inputUrl = etFirstRunUrl?.text?.toString()?.trim().orEmpty()
            val sanitized = sanitizeUrl(inputUrl)
            if (sanitized.isNotEmpty()) {
                prefs.edit().putString(KEY_START_URL, sanitized).apply()
                currentTargetUrl = sanitized
                firstRunContainer?.visibility = View.GONE
                webView.visibility = View.VISIBLE
                floatingNavBar?.visibility = View.VISIBLE
                loadConfiguredUrl(sanitized)
            } else {
                Toast.makeText(this, getString(R.string.invalid_url_msg), Toast.LENGTH_SHORT).show()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.allowFileAccess = true
        webSettings.allowContentAccess = true
        webSettings.allowUniversalAccessFromFileURLs = true
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        webSettings.userAgentString = "VeloPro/1.0.1 (Android; WebView)"
        webSettings.useWideViewPort = true
        webSettings.loadWithOverviewMode = true
        webSettings.builtInZoomControls = true
        webSettings.displayZoomControls = false

        applyCacheSettings()

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(webView, true)

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressPercentage?.text = "$newProgress%"
                if (newProgress in 1..99) {
                    if (!isOfflineError) progressContainer?.visibility = View.VISIBLE
                } else if (newProgress >= 100) {
                    progressContainer?.visibility = View.GONE
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean = false

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                isOfflineError = false
                updateBackBtnState()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressContainer?.visibility = View.GONE
                updateBackBtnState()
                if (!isOfflineError) hideOfflineScreen()
            }

            override fun onReceivedSslError(view: WebView?, handler: SslErrorHandler?, error: SslError?) {
                handler?.proceed()
            }

            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                if (errorCode == ERROR_HOST_LOOKUP || errorCode == ERROR_CONNECT || errorCode == ERROR_TIMEOUT) {
                    isOfflineError = true
                    showOfflineScreen()
                }
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                if (request?.isForMainFrame == true) {
                    isOfflineError = true
                    showOfflineScreen()
                }
            }
        }

        webView.addJavascriptInterface(MainActivity.AndroidBridge(this as Any as MainActivity), "Android")
    }

    private fun applyCacheSettings() {
        val cacheEnabled = prefs.getBoolean(KEY_CACHE_ENABLED, true)
        webView.settings.cacheMode = if (!cacheEnabled) {
            WebSettings.LOAD_NO_CACHE
        } else {
            if (isNetworkConnected()) WebSettings.LOAD_DEFAULT else WebSettings.LOAD_CACHE_ELSE_NETWORK
        }
    }

    private fun loadConfiguredUrl(url: String) {
        if (!isNetworkConnected()) {
            val cacheEnabled = prefs.getBoolean(KEY_CACHE_ENABLED, true)
            if (!cacheEnabled) {
                showOfflineScreen()
                return
            }
        }
        hideOfflineScreen()
        firstRunContainer?.visibility = View.GONE
        webView.visibility = View.VISIBLE
        floatingNavBar?.visibility = View.VISIBLE
        applyCacheSettings()
        webView.loadUrl(url)
    }

    private fun showFirstRunSetup() {
        firstRunContainer?.visibility = View.VISIBLE
        webView.visibility = View.GONE
        floatingNavBar?.visibility = View.GONE
        offlineContainer?.visibility = View.GONE
        progressContainer?.visibility = View.GONE
        etFirstRunUrl?.setText(DEFAULT_SITE_URL)
        etFirstRunUrl?.setSelection(etFirstRunUrl?.text?.length ?: 0)
    }

    private fun showOfflineScreen() {
        offlineContainer?.visibility = View.VISIBLE
        webView.visibility = View.GONE
        progressContainer?.visibility = View.GONE
        floatingNavBar?.visibility = View.VISIBLE
    }

    private fun hideOfflineScreen() {
        offlineContainer?.visibility = View.GONE
        webView.visibility = View.VISIBLE
    }

    private fun updateBackBtnState() {
        btnBack?.alpha = if (webView.canGoBack()) 1.0f else 0.5f
    }

    private fun isNetworkConnected(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return false
        val activeNetwork = cm.activeNetwork ?: return false
        val capabilities = cm.getNetworkCapabilities(activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun sanitizeUrl(input: String): String {
        var url = input.trim()
        if (url.isEmpty()) return ""
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            url = "https://$url"
        }
        return url
    }

    private fun showSettingsDialog() {
        val dialogLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 32, 48, 16)
        }

        val tvUrl = TextView(this).apply {
            text = getString(R.string.settings_url_label)
            textSize = 14f
            setTextColor(0xFF004D40.toInt())
        }

        val etUrl = EditText(this).apply {
            setText(if (currentTargetUrl.isNotEmpty()) currentTargetUrl else DEFAULT_SITE_URL)
            setSelection(text.length)
        }

        val cbCache = CheckBox(this).apply {
            text = getString(R.string.settings_cache_label)
            isChecked = prefs.getBoolean(KEY_CACHE_ENABLED, true)
            setTextColor(0xFF004D40.toInt())
        }

        val btnClearCache = Button(this).apply {
            text = getString(R.string.btn_clear_cache)
            setBackgroundColor(0xFFE0E0E0.toInt())
            setTextColor(0xFF004D40.toInt())
            setOnClickListener {
                webView.clearCache(true)
                CookieManager.getInstance().removeAllCookies(null)
                CookieManager.getInstance().flush()
                Toast.makeText(this@MainActivityKotlin, getString(R.string.cache_cleared_msg), Toast.LENGTH_SHORT).show()
            }
        }

        dialogLayout.addView(tvUrl)
        dialogLayout.addView(etUrl)
        dialogLayout.addView(cbCache)
        dialogLayout.addView(btnClearCache)

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.settings_title))
            .setView(dialogLayout)
            .setPositiveButton("Применить") { _, _ ->
                val newUrl = sanitizeUrl(etUrl.text.toString())
                val cacheChecked = cbCache.isChecked
                if (newUrl.isNotEmpty()) {
                    prefs.edit()
                        .putString(KEY_START_URL, newUrl)
                        .putBoolean(KEY_CACHE_ENABLED, cacheChecked)
                        .apply()
                    currentTargetUrl = newUrl
                    applyCacheSettings()
                    loadConfiguredUrl(newUrl)
                    Toast.makeText(this, "Настройки сохранены", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this, getString(R.string.invalid_url_msg), Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Отмена", null)
            .show()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (firstRunContainer?.visibility == View.VISIBLE) {
            return super.onKeyDown(keyCode, event)
        }
        if (keyCode == KeyEvent.KEYCODE_BACK && webView.canGoBack()) {
            webView.goBack()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}
