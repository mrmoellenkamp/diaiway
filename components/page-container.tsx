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
        "mx-auto max-w-lg",
        "pb-[max(10rem,calc(6rem+env(safe-area-inset-bottom)))]", // BottomNav + FAB + Safe Area (iPhone 15/16)
        "min-h-[calc(100dvh-4rem)]", // 100dvh = iOS viewport, avoids address-bar jump
        !noPadding && "px-4 py-4",
        className
      )}
    >
      {children}
    </main>
  )
}
