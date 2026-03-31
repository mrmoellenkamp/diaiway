import Image from "next/image"
import { cn } from "@/lib/utils"

type BetaFounderCardProps = {
  /** z. B. „Founder“ / „Fundador“ */
  label: string
  /** Voller Name-Zeile */
  name: string
  imageAlt: string
  className?: string
}

/**
 * Horizontale „Visitenkarte“: Foto links, Rolle + Name rechts — abgerundet, Schatten, wie auf der Beta-Landing.
 */
export function BetaFounderCard({ label, name, imageAlt, className }: BetaFounderCardProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-xl items-center gap-4 rounded-3xl bg-white p-5 shadow-[0_4px_28px_rgba(15,23,42,0.1)] ring-1 ring-[rgba(231,229,228,0.8)] sm:gap-6 sm:p-6 md:max-w-2xl md:gap-8 md:p-8",
        className,
      )}
    >
      <div className="relative size-[5.5rem] shrink-0 overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200 sm:size-28 md:size-32">
        <Image
          src="/beta/jens-founder.png"
          alt={imageAlt}
          width={128}
          height={128}
          priority
          className="h-full w-full object-cover object-[center_18%]"
          sizes="128px"
        />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary sm:text-[11px]">{label}</p>
        <p className="mt-1.5 text-lg font-bold leading-tight tracking-tight text-stone-900 sm:text-xl md:text-2xl">
          {name}
        </p>
      </div>
    </div>
  )
}
