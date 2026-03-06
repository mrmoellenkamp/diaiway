export function LiveBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-accent/15 font-medium text-accent ${
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs"
      }`}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-live-pulse rounded-full bg-accent opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      Live
    </span>
  )
}
