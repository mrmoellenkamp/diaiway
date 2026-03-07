"use client"

import { useEffect } from "react"

/**
 * Catches errors in the root layout. Required for Next.js:
 * - Must define its own <html> and <body>
 * - Renders when error.tsx cannot (e.g. root layout errors)
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Global Error]", error.message, error.digest, error.stack)
  }, [error])

  return (
    <html lang="de">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>
            Etwas ist schiefgelaufen
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem", textAlign: "center" }}>
            Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
          </p>
          {process.env.NODE_ENV === "development" && (
            <pre
              style={{
                maxWidth: "100%",
                overflow: "auto",
                padding: "1rem",
                background: "#f5f5f5",
                borderRadius: "8px",
                fontSize: "12px",
                marginBottom: "1rem",
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid #ccc",
              background: "white",
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  )
}
