-- CreateTable
CREATE TABLE "CronRunLog" (
    "id" TEXT NOT NULL,
    "cronName" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CronRunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CronRunLog_cronName_key" ON "CronRunLog"("cronName");
