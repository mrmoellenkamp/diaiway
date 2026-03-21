/**
 * Root-Loading: sichtbar während RSC/streaming – reduziert „weißen Bildschirm“ in
 * Capacitor/Android-WebView, wenn JS/CSS noch nachladen.
 * Nur Inline-Styles (kein Tailwind), falls globales CSS verzögert.
 */
export default function RootLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        backgroundColor: "#fafaf9",
        color: "#064e3b",
        fontFamily: "system-ui, sans-serif",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "2.25rem",
          height: "2.25rem",
          borderRadius: "9999px",
          border: "3px solid #064e3b",
          borderTopColor: "transparent",
          animation: "diaiway-spin 0.75s linear infinite",
        }}
      />
      <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>diAiway</p>
      <style>{`@keyframes diaiway-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
