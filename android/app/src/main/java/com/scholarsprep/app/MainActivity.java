package com.scholarsprep.app;

import android.os.Bundle;
import android.view.WindowManager; 
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 1. BLOCK SCREENSHOTS
        // This must be inside the APK to work.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);

        // 2. CACHE SETTINGS
        WebView webView = this.bridge.getWebView();
        WebSettings settings = webView.getSettings();
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
    }

    // 3. FIX SYSTEM NAVIGATION (Back Button)
    // This stops the app from exiting when you press "Back"
    @Override
    public void onBackPressed() {
        WebView webView = this.bridge.getWebView();
        if (webView.canGoBack()) {
            webView.goBack(); // Navigate back within Scholars Prep
        } else {
            super.onBackPressed(); // Only close app if on the Home/Dashboard
        }
    }
}