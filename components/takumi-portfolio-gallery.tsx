"use client"

import { useState } from "react"
import Image from "next/image"
import { ImageLightbox } from "@/components/image-lightbox"
import { Button } from "@/components/ui/button"
import { useI18n } from "@/lib/i18n"
import { Trash2 } from "lucide-react"

export interface TakumiPortfolioProject {
  id: string
  title: string
  description: string
  imageUrl: string
  category: string
  completionDate: string | null
  createdAt: string
}

interface TakumiPortfolioGalleryProps {
  projects: TakumiPortfolioProject[]
  /** Wenn true: nur Galerie ohne Lightbox-Klick (Read-only-Anzeige) */
  readOnly?: boolean
  /** Titel über der Galerie (z.B. "Meisterstücke") */
  title?: string
  /** Leere-Galerie-Nachricht */
  emptyMessage?: string
  /** Optional: Lösch-Callback — wenn gesetzt, wird ein Lösch-Button pro Projekt angezeigt */
  onDelete?: (id: string) => void
}

export function TakumiPortfolioGallery({
  projects,
  readOnly = false,
  title,
  emptyMessage,
  onDelete,
}: TakumiPortfolioGalleryProps) {
  const { t } = useI18n()
  const [lightbox, setLightbox] = useState<{
    src: string
    alt: string
    caption?: string
  } | null>(null)

  const displayTitle = title ?? t("takumiPage.portfolio")
  const displayEmpty = emptyMessage ?? t("portfolio.empty")

  if (projects.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-foreground">{displayTitle}</h2>
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 py-10 text-center">
          <p className="text-sm text-muted-foreground">{displayEmpty}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-foreground">{displayTitle}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {projects.map((p) => (
          <div
            key={p.id}
            className={[
              "group relative overflow-hidden rounded-xl border border-border/60 bg-card transition-all",
              !readOnly && p.imageUrl
                ? "cursor-pointer hover:scale-[1.02] hover:shadow-md hover:ring-2 hover:ring-primary/40"
                : "",
            ].join(" ")}
          >
            {onDelete && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1 z-10 size-7 rounded-full bg-black/40 text-white hover:bg-destructive hover:text-white"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(p.id)
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            )}
            <button
              type="button"
              onClick={() => {
                if (!readOnly && p.imageUrl) {
                  setLightbox({
                    src: p.imageUrl,
                    alt: p.title,
                    caption: p.description || p.title,
                  })
                }
              }}
              className="block h-full w-full text-left"
            >
              <div className="aspect-square relative bg-muted">
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={p.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 33vw"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted-foreground/50">
                    <span className="text-xs">{p.title}</span>
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <p className="line-clamp-1 text-xs font-semibold text-foreground">
                  {p.title}
                </p>
                {p.category && (
                  <p className="text-[10px] text-muted-foreground">{p.category}</p>
                )}
              </div>
            </button>
          </div>
        ))}
      </div>

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          caption={lightbox.caption}
          open={!!lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
