import { cn } from "@/lib/utils"

export function PageContainer({
  children,
  className,
  noPadding = false,
}: {
  children: React.ReactNode
  className?: string
  noPadding?: boolean
}) {
  return (
    <main
      className={cn(
        "mx-auto max-w-lg pb-24", // pb-24 = 96px to account for bottom nav (~64px) + FAB space
        "min-h-[calc(100vh-4rem)]", // min-height minus header
        !noPadding && "px-4 py-4",
        className
      )}
    >
      {children}
    </main>
  )
}
