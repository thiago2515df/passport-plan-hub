package br.com.excursaobrasilia.propostas

import android.app.Activity
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.graphics.Insets
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.URLUtil
import android.widget.FrameLayout
import android.widget.Toast

class MainActivity : Activity() {
    private val home = "https://propostabsb.excursaobrasilia.com.br/"
    private val allowedHost = "propostabsb.excursaobrasilia.com.br"
    private lateinit var browser: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val fileRequest = 4001

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        browser = WebView(this)
        val container = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(247, 248, 251))
            addView(browser, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            ))
        }
        setContentView(container)
        configureWindowInsets(container)
        browser.settings.javaScriptEnabled = true
        browser.settings.domStorageEnabled = true
        browser.settings.allowFileAccess = false
        browser.settings.allowContentAccess = true
        browser.settings.setSupportMultipleWindows(false)
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(browser, true)

        browser.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "https" && uri.host.equals(allowedHost, ignoreCase = true)) return false
                return openExternal(uri)
            }
        }
        browser.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                return try {
                    startActivityForResult(fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                        type = "*/*"
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }, fileRequest)
                    true
                } catch (e: ActivityNotFoundException) {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                    false
                }
            }
        }
        browser.setDownloadListener(DownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            val uri = Uri.parse(url)
            if (uri.scheme != "https") {
                Toast.makeText(this, "Download não permitido", Toast.LENGTH_SHORT).show()
                return@DownloadListener
            }
            try {
                val request = DownloadManager.Request(uri)
                    .setMimeType(mimeType)
                    .addRequestHeader("User-Agent", userAgent ?: "")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType))
                // Authenticated downloads may require cookies for the official host.
                if (uri.host.equals(allowedHost, ignoreCase = true)) {
                    CookieManager.getInstance().getCookie(url)?.let { request.addRequestHeader("Cookie", it) }
                }
                (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, "Download iniciado", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Não foi possível baixar o arquivo", Toast.LENGTH_LONG).show()
            }
        })
        if (savedInstanceState == null) browser.loadUrl(home) else browser.restoreState(savedInstanceState)
    }

    @Suppress("DEPRECATION")
    private fun configureWindowInsets(container: FrameLayout) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
            window.statusBarColor = Color.TRANSPARENT
            window.navigationBarColor = Color.TRANSPARENT
            val lightBars = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(lightBars, lightBars)
            container.setOnApplyWindowInsetsListener { view, insets ->
                val handledTypes = WindowInsets.Type.systemBars() or
                    WindowInsets.Type.displayCutout() or WindowInsets.Type.ime()
                val safe = insets.getInsets(handledTypes)
                // Keep the WebView itself inside the visible area, including when typing.
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
                // Zero only the handled insets so WebView does not add them a second time.
                WindowInsets.Builder(insets).setInsets(handledTypes, Insets.NONE).build()
            }
            container.requestApplyInsets()
        } else {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or
                View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
            window.statusBarColor = Color.rgb(247, 248, 251)
            window.navigationBarColor = Color.WHITE
        }
    }

    private fun openExternal(uri: Uri): Boolean {
        return try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
            true
        } catch (e: Exception) {
            Toast.makeText(this, "Não foi possível abrir o link", Toast.LENGTH_SHORT).show()
            true
        }
    }

    @Deprecated("Used for file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == fileRequest) {
            fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            fileCallback = null
        }
    }

    @Deprecated("Used for WebView back navigation")
    override fun onBackPressed() {
        if (browser.canGoBack()) browser.goBack() else super.onBackPressed()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        browser.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    override fun onDestroy() {
        browser.destroy()
        super.onDestroy()
    }
}
