-- Optionale Links pro Sprachfassung (Fallback bleibt auf HomeNewsItem.linkUrl / linkLabel)
ALTER TABLE "HomeNewsTranslation" ADD COLUMN "linkUrl" TEXT;
ALTER TABLE "HomeNewsTranslation" ADD COLUMN "linkLabel" TEXT;
