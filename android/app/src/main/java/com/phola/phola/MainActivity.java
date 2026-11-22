package com.phola.phola;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public class MainActivity extends BridgeActivity implements LocationListener {
    private static final int PERMISSION_REQUEST_CODE = 9110;
    private LocationManager locationManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebView();
        requestEssentialRuntimePermissions();
        startNativeLocationTracking();
        handleSendIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        configureWebView();
        startNativeLocationTracking();
    }

    private void requestEssentialRuntimePermissions() {
        try {
            List<String> needed = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.ACCESS_COARSE_LOCATION);
            }
            if (Build.VERSION.SDK_INT >= 33) {
                if (ContextCompat.checkSelfPermission(this, "android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    needed.add("android.permission.POST_NOTIFICATIONS");
                }
            }
            if (!needed.isEmpty()) {
                ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), PERMISSION_REQUEST_CODE);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == PERMISSION_REQUEST_CODE) {
            startNativeLocationTracking();
        }
    }

    @SuppressLint("MissingPermission")
    private void startNativeLocationTracking() {
        try {
            boolean hasFine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            boolean hasCoarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            if (!hasFine && !hasCoarse) return;

            if (locationManager == null) {
                locationManager = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
            }
            if (locationManager == null) return;

            if (hasFine && locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 4000L, 3.0f, this);
                Location lastGps = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER);
                if (lastGps != null) onLocationChanged(lastGps);
            }
            if (locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
                locationManager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 6000L, 5.0f, this);
                Location lastNet = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER);
                if (lastNet != null) onLocationChanged(lastNet);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onLocationChanged(Location location) {
        if (location == null) return;
        final double lat = location.getLatitude();
        final double lng = location.getLongitude();
        final String speed = location.hasSpeed() ? String.format(Locale.US, "%.2f", location.getSpeed()) : "null";
        final String heading = location.hasBearing() ? String.format(Locale.US, "%.2f", location.getBearing()) : "null";

        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                final String js = String.format(
                    Locale.US,
                    "(function(){try{var p={lat:%.6f,lng:%.6f,speed:%s,heading:%s,ts:Date.now()};window.localStorage.setItem('phola_last_gps',JSON.stringify(p));window.sessionStorage.setItem('phola_last_gps',JSON.stringify(p));window.dispatchEvent(new CustomEvent('phola-background-location',{detail:p}));window.postMessage({type:'PHOLA_BACKGROUND_LOCATION',data:p},'*');}catch(e){}})();",
                    lat, lng, speed, heading
                );
                webView.post(() -> {
                    try {
                        webView.evaluateJavascript(js, null);
                    } catch (Exception ignored) {}
                });
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onProviderEnabled(String provider) {}

    @Override
    public void onProviderDisabled(String provider) {}

    @Override
    public void onStatusChanged(String provider, int status, Bundle extras) {}

    private void configureWebView() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                WebView webView = this.bridge.getWebView();
                webView.post(() -> {
                    try {
                        WebSettings settings = webView.getSettings();
                        settings.setGeolocationEnabled(true);
                        settings.setDomStorageEnabled(true);
                        settings.setJavaScriptEnabled(true);
                        settings.setMediaPlaybackRequiresUserGesture(false);
                        // Follow standard HTTP cache-control headers (no-cache/must-revalidate)
                        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                        // Clear transient disk & memory HTTP resource cache on startup
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
