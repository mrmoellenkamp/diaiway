package com.diaiway.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Debug: WebView in Chrome unter chrome://inspect#devices inspizieren (JS-Fehler, Netzwerk).
 * Nur im Debug-Build aktiv – in Release kein Overhead.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    if (BuildConfig.DEBUG) {
      WebView.setWebContentsDebuggingEnabled(true);
    }
  }
}
