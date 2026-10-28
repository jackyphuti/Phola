package com.phola.phola;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import java.net.URLEncoder;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebView();
        handleSendIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
    }

    private void configureWebView() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.post(() -> {
                    try {
                        WebSettings settings = webView.getSettings();
                        // Follow standard HTTP cache-control headers (no-cache/must-revalidate)
                        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                        // Clear transient disk & memory HTTP resource cache on startup
                        // (passing true clears temporary web assets while preserving localStorage, cookies, and IndexedDB)
                        webView.clearCache(true);
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleSendIntent(intent);
    }

    private void handleSendIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null && "text/plain".equals(type)) {
            String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
            if (sharedText != null && !sharedText.trim().isEmpty()) {
                try {
                    String encoded = URLEncoder.encode(sharedText, "UTF-8");
                    if (this.bridge != null && this.bridge.getWebView() != null) {
                        this.bridge.getWebView().post(() -> {
                            this.bridge.getWebView().loadUrl("https://phola-beta.vercel.app/safe-ride?shared_text=" + encoded);
                        });
                    }
                } catch (Exception ignored) {}
            }
        }
    }
}
