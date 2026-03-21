-- Site analytics: sessions + page views for admin dashboard (visitors, dwell time, paths)

CREATE TABLE "SiteAnalyticsSession" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagedSeconds" INTEGER NOT NULL DEFAULT 0,
    "entryPath" VARCHAR(512) NOT NULL,
    "referrer" VARCHAR(512),
    "userAgent" VARCHAR(400),

    CONSTRAINT "SiteAnalyticsSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SiteAnalyticsPageView" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "path" VARCHAR(512) NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteAnalyticsPageView_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SiteAnalyticsSession_visitorId_startedAt_idx" ON "SiteAnalyticsSession"("visitorId", "startedAt");

CREATE INDEX "SiteAnalyticsSession_startedAt_idx" ON "SiteAnalyticsSession"("startedAt");

CREATE INDEX "SiteAnalyticsSession_userId_idx" ON "SiteAnalyticsSession"("userId");

CREATE INDEX "SiteAnalyticsPageView_sessionId_idx" ON "SiteAnalyticsPageView"("sessionId");

CREATE INDEX "SiteAnalyticsPageView_path_idx" ON "SiteAnalyticsPageView"("path");

CREATE INDEX "SiteAnalyticsPageView_enteredAt_idx" ON "SiteAnalyticsPageView"("enteredAt");

ALTER TABLE "SiteAnalyticsSession" ADD CONSTRAINT "SiteAnalyticsSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SiteAnalyticsPageView" ADD CONSTRAINT "SiteAnalyticsPageView_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SiteAnalyticsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
