# Capacitor Bridge — darf nicht obfuskiert werden (JS-Interface wird per Reflection aufgerufen)
-keep class com.getcapacitor.** { *; }
-keep class com.diaiway.app.** { *; }

# Capacitor Plugins (alle registrierten Plugins per Annotation)
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.annotation.PluginMethod *;
}

# WebView JS Interface — muss erreichbar bleiben
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public *;
}
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Cordova-Plugins (für Capacitor-Cordova-Bridge)
-keep class org.apache.cordova.** { *; }

# Stack-Trace-Informationen für Crash-Reporting erhalten
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
