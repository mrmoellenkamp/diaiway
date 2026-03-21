/**
 * Legt einen einzelnen Home-News-Beitrag mit Übersetzungen DE / EN / ES an
 * (erscheint im Feed auf /home je nach UI-Sprache).
 *
 * Ausführen (DATABASE_URL in .env):
 *   npm run seed:home-news-post
 *
 * Idempotent: entfernt zuvor den Eintrag mit fester ID und legt ihn neu an.
 */
import { PrismaClient } from "@prisma/client"
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library"

const prisma = new PrismaClient()

const ITEM_ID = "homenews_platform_update_001" as const

async function hasHomeNewsTranslationTable(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'HomeNewsTranslation'
    ) AS "exists"
  `
  return rows[0]?.exists === true
}

function isHomeNewsTitleRequiredError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false
  const x = e as { code?: string; meta?: { constraint?: string[] } }
  return (
    x.code === "P2011" &&
    Array.isArray(x.meta?.constraint) &&
    x.meta!.constraint.includes("title")
  )
}

/** Deutsche Fassung = Fallback für Legacy-INSERT (Spalten title/body auf HomeNewsItem) */
const DE = {
  title: "Live-Experten und KI-Guide — alles an einem Ort",
  body:
    "Stell deine DIY-Frage an die diAiway intelligence oder buche einen Takumi für Video oder Sprache. Sichere Zahlung, klare Abläufe — probier es auf der Plattform aus.",
}

const TRANSLATIONS = [
  { locale: "de" as const, title: DE.title, body: DE.body },
  {
    locale: "en" as const,
    title: "Live experts and AI guide — all in one place",
    body:
      "Ask the diAiway intelligence or book a Takumi for video or voice. Secure payments and clear flows — explore the platform and find your match.",
  },
  {
    locale: "es" as const,
    title: "Expertos en vivo y guía IA — todo en un solo lugar",
    body:
      "Pregunta a la diAiway intelligence o reserva un Takumi por video o voz. Pagos seguros y procesos claros — descubre la plataforma.",
  },
]

async function main() {
  if (!prisma.homeNewsItem) {
    console.error(
      [
        "Prisma Client kennt das Modell HomeNewsItem nicht.",
        "Bitte: npm run db:generate",
        "Danach: npm run seed:home-news-post",
      ].join("\n"),
    )
    process.exit(1)
  }

  await prisma.homeNewsItem.deleteMany({ where: { id: ITEM_ID } })

  const publishedAt = new Date()
  const sortOrder = -9

  try {
    await prisma.homeNewsItem.create({
      data: {
        id: ITEM_ID,
        linkUrl: "/categories",
        linkLabel: null,
        published: true,
        sortOrder,
        publishedAt,
        translations: {
          create: TRANSLATIONS.map((tr) => ({
            locale: tr.locale,
            title: tr.title,
            body: tr.body,
          })),
        },
      },
    })
  } catch (e) {
    if (!isHomeNewsTitleRequiredError(e)) throw e
    const trTable = await hasHomeNewsTranslationTable()
    if (!trTable) {
      console.error(
        [
          "Deine Datenbank hat noch das alte Home-News-Schema: Tabelle „HomeNewsTranslation“ fehlt.",
          "Ohne Migration kann dieser Seed keine mehrsprachigen Beiträge anlegen.",
          "",
          "Bitte zuerst ausführen:",
          "  npm run db:migrate:deploy",
          "",
          "Danach erneut:",
          "  npm run seed:home-news-post",
        ].join("\n"),
      )
      process.exit(1)
    }
    const now = new Date()
    await prisma.$executeRaw`
      INSERT INTO "HomeNewsItem" ("id", "title", "body", "linkUrl", "linkLabel", "published", "sortOrder", "publishedAt", "createdAt", "updatedAt")
      VALUES (${ITEM_ID}, ${DE.title}, ${DE.body}, ${"/categories"}, ${null}, ${true}, ${sortOrder}, ${publishedAt}, ${now}, ${now})
    `
    try {
      for (const tr of TRANSLATIONS) {
        await prisma.homeNewsTranslation.create({
          data: {
            newsItemId: ITEM_ID,
            locale: tr.locale,
            title: tr.title,
            body: tr.body,
          },
        })
      }
    } catch (inner) {
      await prisma.homeNewsItem.deleteMany({ where: { id: ITEM_ID } }).catch(() => {})
      if (inner instanceof PrismaClientKnownRequestError && inner.code === "P2021") {
        console.error(
          [
            "Tabelle „HomeNewsTranslation“ ist während des Seeds nicht erreichbar (P2021).",
            "Bitte: npm run db:migrate:deploy — dann Seed erneut ausführen.",
          ].join("\n"),
        )
        process.exit(1)
      }
      throw inner
    }
  }

  console.log(
    `OK: Home-News-Beitrag "${ITEM_ID}" mit DE/EN/ES angelegt (sortOrder=${sortOrder}, Link /categories).`,
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
