package com.scholarsprep.app;

import android.os.Bundle;
import android.view.WindowManager; // Added for FLAG_SECURE
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // --- 1. BLOCK SCREENSHOTS & RECORDINGS ---
        // This makes the screen black for recorders and blocks screenshots
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);

        // --- 2. CACHE SETTINGS (Your existing code) ---
        WebView webView = this.bridge.getWebView();
        WebSettings settings = webView.getSettings();
        
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
    }
}