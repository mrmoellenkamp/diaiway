"use client"

import { PageContainer } from "@/components/page-container"
import { MentorChat } from "@/components/mentor-chat"
import { useI18n } from "@/lib/i18n"

export default function AiGuidePage() {
  const { t } = useI18n()

  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">{t("aiGuide.pageHeading")}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("aiGuide.introText")}
        </p>
        <MentorChat variant="fullpage" className="h-[380px] max-h-ai-guide-chat" />
      </div>
    </PageContainer>
  )
}
