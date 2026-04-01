package com.diaiway.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * Debug: WebView in Chrome unter chrome://inspect#devices inspizieren (JS-Fehler, Netzwerk).
 * Nur im Debug-Build aktiv – in Release kein Overhead.
 *
 * FCM nutzt channelId = pushType ({@link lib/push-fcm.ts}); Kanäle müssen existieren (Android 8+),
 * sonst können Pushs auf dem Sperrbildschirm fehlen oder stumm laufen.
 */
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    ensureFcmNotificationChannels();
    if (BuildConfig.DEBUG) {
      WebView.setWebContentsDebuggingEnabled(true);
    }
  }

  private void ensureFcmNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;

    createHigh(nm, "GENERAL", "Allgemein");
    createHigh(nm, "REMINDER", "Session-Erinnerungen");
    createHigh(nm, "BOOKING_REQUEST", "Buchungsanfragen");
    createHigh(nm, "BOOKING_UPDATE", "Buchungs-Updates");
    createDefault(nm, "MESSAGE", "Nachrichten");
    createHigh(nm, "PAYMENT", "Zahlungen");
  }

  private static void createHigh(NotificationManager nm, String id, String name) {
    NotificationChannel ch = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
    ch.enableVibration(true);
    ch.setShowBadge(true);
    nm.createNotificationChannel(ch);
  }

  private static void createDefault(NotificationManager nm, String id, String name) {
    NotificationChannel ch = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_DEFAULT);
    ch.setShowBadge(true);
    nm.createNotificationChannel(ch);
  }
}
