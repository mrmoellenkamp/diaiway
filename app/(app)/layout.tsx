import { ErrorBoundary } from "@/components/error-boundary"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh-fallback bg-background">
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </div>
  )
}
