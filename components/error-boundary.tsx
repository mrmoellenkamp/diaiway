"use client"

import { Component, type ReactNode } from "react"
import { AlertTriangle, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-8 text-destructive" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-foreground">
              Etwas ist schiefgelaufen
            </h3>
            <p className="max-w-sm text-sm text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
            </p>
          </div>
          <Button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            variant="outline"
            className="gap-2"
          >
            <RefreshCcw className="size-4" />
            Erneut versuchen
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

/** Inline error display for data loading failures */
export function DataError({
  message = "Daten konnten nicht geladen werden.",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
      <AlertTriangle className="size-6 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <RefreshCcw className="size-3.5" />
          Erneut laden
        </Button>
      )}
    </div>
  )
}

/** Loading state with skeleton or spinner */
export function LoadingState({
  variant = "spinner",
  message = "Laden...",
}: {
  variant?: "spinner" | "skeleton"
  message?: string
}) {
  if (variant === "skeleton") {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-24 w-full animate-pulse rounded-xl bg-muted"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

/** Empty state for no data scenarios */
export function EmptyState({
  title = "Keine Daten",
  description = "Es sind noch keine Eintraege vorhanden.",
  icon: Icon = AlertTriangle,
  action,
}: {
  title?: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  )
}
