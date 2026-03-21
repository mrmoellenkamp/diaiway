import { HOME_NEWS_LOCALES, type HomeNewsLocale } from "@/lib/home-news-locales"

export type HomeNewsItemWithTranslations = {
  id: string
  linkUrl: string | null
  linkLabel: string | null
  published: boolean
  sortOrder: number
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  translations: {
    locale: string
    title: string
    body: string
    linkUrl?: string | null
    linkLabel?: string | null
  }[]
}

/** Admin-API: flache Übersetzungen als Objekt { de, en, es }. */
export function serializeAdminHomeNewsItem(item: HomeNewsItemWithTranslations) {
  const translations: Partial<
    Record<HomeNewsLocale, { title: string; body: string; linkUrl: string | null; linkLabel: string | null }>
  > = {}
  for (const loc of HOME_NEWS_LOCALES) {
    const t = item.translations.find((x) => x.locale === loc)
    if (t)
      translations[loc] = {
        title: t.title,
        body: t.body,
        linkUrl: t.linkUrl ?? null,
        linkLabel: t.linkLabel ?? null,
      }
  }
  return {
    id: item.id,
    linkUrl: item.linkUrl,
    linkLabel: item.linkLabel,
    published: item.published,
    sortOrder: item.sortOrder,
    publishedAt: item.publishedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    translations,
  }
}
