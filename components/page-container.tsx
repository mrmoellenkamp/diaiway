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
        "mx-auto w-full max-w-lg min-w-0",
        "pb-[max(10rem,calc(6rem+env(safe-area-inset-bottom,0px)))]", // BottomNav + FAB + Safe Area (iOS/Android)
        "min-h-calc-dvh-minus-4", // vh→dvh-Fallback: alte Android-WebView
        !noPadding && "py-4",
        !noPadding && "pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]",
        className
      )}
    >
      {children}
    </main>
  )
}
