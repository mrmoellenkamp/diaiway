-- CreateTable
CREATE TABLE "HomeNewsItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "linkLabel" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeNewsItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HomeNewsItem_published_sortOrder_idx" ON "HomeNewsItem"("published", "sortOrder");
