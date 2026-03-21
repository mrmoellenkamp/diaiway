-- CreateTable
CREATE TABLE "HomeNewsTranslation" (
    "id" TEXT NOT NULL,
    "newsItemId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "HomeNewsTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HomeNewsTranslation_newsItemId_locale_key" ON "HomeNewsTranslation"("newsItemId", "locale");
CREATE INDEX "HomeNewsTranslation_newsItemId_idx" ON "HomeNewsTranslation"("newsItemId");
CREATE INDEX "HomeNewsTranslation_locale_idx" ON "HomeNewsTranslation"("locale");

ALTER TABLE "HomeNewsTranslation" ADD CONSTRAINT "HomeNewsTranslation_newsItemId_fkey" FOREIGN KEY ("newsItemId") REFERENCES "HomeNewsItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestehende Titel/Texte als deutsche Fassung übernehmen
INSERT INTO "HomeNewsTranslation" ("id", "newsItemId", "locale", "title", "body")
SELECT 'hmtr_de_' || "id", "id", 'de', "title", "body"
FROM "HomeNewsItem";

ALTER TABLE "HomeNewsItem" DROP COLUMN "title",
DROP COLUMN "body";
