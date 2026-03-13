import { ErrorBoundary } from "@/components/error-boundary"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <ErrorBoundary>
        {children}
      </ErrorBoundary>
    </div>
  )
}
