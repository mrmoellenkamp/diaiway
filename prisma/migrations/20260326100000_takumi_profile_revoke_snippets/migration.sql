-- CreateTable
CREATE TABLE "TakumiProfileRevokeSnippet" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TakumiProfileRevokeSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TakumiProfileRevokeSnippet_isActive_sortOrder_idx" ON "TakumiProfileRevokeSnippet"("isActive", "sortOrder");

-- Seed default snippet
INSERT INTO "TakumiProfileRevokeSnippet" ("id", "title", "body", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES (
  'cm0000000000000000000000',
  'Richtlinienverstoß',
  'Deine Takumi-Profilfreigabe wurde vorübergehend entzogen. Bitte prüfe dein Profil und passe es an unsere Richtlinien an. Bei Rückfragen kontaktiere das diAiway-Team per E-Mail: admin@diaiway.com',
  true,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
