/**
 * Legt drei Startseiten-News an (je nur eine Sprachfassung), damit im Feed pro UI-Sprache
 * ein Teaser mit Link zur passenden Beta-Landing erscheint.
 *
 * Ausführen (DATABASE_URL in .env):
 *   npm run seed:home-news-beta
 *   (führt zuerst prisma generate aus — siehe package.json)
 *
 * Idempotent: entfernt zuvor Einträge mit den festen IDs und legt sie neu an.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const BETA_ITEM_IDS = ["homebeta_de", "homebeta_en", "homebeta_es"] as const

function isHomeNewsTitleRequiredError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const x = e as { code?: string; meta?: { constraint?: string[] } }
  return (
    x.code === "P2011" &&
    Array.isArray(x.meta?.constraint) &&
    x.meta!.constraint.includes("title")
  )
}

const ROWS = [
  {
    id: "homebeta_de" as const,
    linkUrl: "/beta/de",
    linkLabel: "Zur Beta-Seite",
    locale: "de" as const,
    title: "Wir suchen Beta-Tester:innen",
    body: "diAiway ist fast startklar — werde einer der Ersten, teste die Plattform und hilf uns mit Feedback. Jetzt informieren und mitmachen.",
  },
  {
    id: "homebeta_en" as const,
    linkUrl: "/beta/en",
    linkLabel: "Open beta page",
    locale: "en" as const,
    title: "We're looking for beta testers",
    body: "diAiway is almost ready — be among the first to try the platform and share your feedback. Learn more and join the beta.",
  },
  {
    id: "homebeta_es" as const,
    linkUrl: "/beta/es",
    linkLabel: "Ir a la beta",
    locale: "es" as const,
    title: "Buscamos beta testers",
    body: "diAiway está casi listo — sé de los primeros en probar la plataforma y darnos tu opinión. Infórmate y únete a la beta.",
  },
]

async function main() {
  if (!prisma.homeNewsItem) {
    console.error(
      [
        "Prisma Client kennt das Modell HomeNewsItem nicht (homeNewsItem fehlt).",
        "Bitte ausführen:  npm run db:generate",
        "oder:             node scripts/prisma-runner.mjs generate",
        "Danach erneut:    npm run seed:home-news-beta",
      ].join("\n"),
    )
    process.exit(1)
  }

  await prisma.homeNewsItem.deleteMany({
    where: { id: { in: [...BETA_ITEM_IDS] } },
  })

  const publishedAt = new Date()

  for (const row of ROWS) {
    try {
      await prisma.homeNewsItem.create({
        data: {
          id: row.id,
          linkUrl: row.linkUrl,
          linkLabel: row.linkLabel,
          published: true,
          sortOrder: -10,
          publishedAt,
          translations: {
            create: {
              locale: row.locale,
              title: row.title,
              body: row.body,
            },
          },
        },
      })
    } catch (e) {
      // DB noch mit alter Migration: "HomeNewsItem"."title"/"body" NOT NULL (Spalten noch nicht entfernt)
      if (!isHomeNewsTitleRequiredError(e)) throw e
      const now = new Date()
      await prisma.$executeRaw`
        INSERT INTO "HomeNewsItem" ("id", "title", "body", "linkUrl", "linkLabel", "published", "sortOrder", "publishedAt", "createdAt", "updatedAt")
        VALUES (${row.id}, ${row.title}, ${row.body}, ${row.linkUrl}, ${row.linkLabel}, ${true}, ${-10}, ${publishedAt}, ${now}, ${now})
      `
      try {
        await prisma.homeNewsTranslation.create({
          data: {
            newsItemId: row.id,
            locale: row.locale,
            title: row.title,
            body: row.body,
          },
        })
      } catch (transErr) {
        console.error(
          [
            "Hinweis: HomeNewsItem wurde angelegt, HomeNewsTranslation aber nicht.",
            "Die Tabelle fehlt oder die Migration ist unvollständig. Bitte ausführen:",
            "  npm run db:migrate:deploy",
          ].join("\n"),
        )
        throw transErr
      }
    }
  }

  console.log(`OK: ${ROWS.length} Home-News-Einträge für Beta (DE / EN / ES) angelegt, sortOrder=-10, veröffentlicht.`)
  console.log(
    "Tipp: Sobald die Migration „home_news_translations“ auf der DB liegt, kannst du title/body aus HomeNewsItem entfernen (nur Übersetzungen).",
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
