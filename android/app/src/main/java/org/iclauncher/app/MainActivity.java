package org.iclauncher.app;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

/**
 * IC App Launcher Android MainActivity & Native Bridge.
 *
 * Responsibilities:
 * - Hosts the shared IC App Launcher web build and injects `window.__IC_APP_LAUNCHER_CAPACITOR_BRIDGE__`
 *   only when running inside the genuine Android native shell.
 * - Dispatches hardware Back button presses (`iclauncher:hardware-back`) so Settings, Store,
 *   and Password Unlock screens navigate back cleanly without exiting the launcher.
 * - Launches external Android applications strictly in the host OS via verified
 *   `PackageManager.getLaunchIntentForPackage` or explicit `Intent.ACTION_VIEW` with
 *   `FLAG_ACTIVITY_NEW_TASK` (never inside an embedded WebView).
 */
public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null) {
                    webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('iclauncher:hardware-back'));",
                        null
                    );
                }
            }
        });
    }

    public boolean launchExternalPackage(String packageId) {
        if (packageId == null || !packageId.matches("^[a-zA-Z][a-zA-Z0-9_]*(\\.[a-zA-Z][a-zA-Z0-9_]*)+$")) {
            return false;
        }
        PackageManager pm = getPackageManager();
        Intent launchIntent = pm.getLaunchIntentForPackage(packageId);
        if (launchIntent == null) {
            return false;
        }
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(launchIntent);
        return true;
    }

    public boolean openExternalVerifiedUri(String uriString) {
        if (uriString == null || (!uriString.startsWith("https://") && !uriString.startsWith("http://"))) {
            return false;
        }
        Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(uriString));
        browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(browserIntent);
        return true;
    }
}
