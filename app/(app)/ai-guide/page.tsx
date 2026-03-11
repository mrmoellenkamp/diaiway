"use client"

import { PageContainer } from "@/components/page-container"
import { MentorChat } from "@/components/mentor-chat"

export default function AiGuidePage() {
  return (
    <PageContainer>
      <div className="flex flex-col gap-4">
        <MentorChat variant="fullpage" />
      </div>
    </PageContainer>
  )
}
