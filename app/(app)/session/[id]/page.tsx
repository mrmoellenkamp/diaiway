"use client"

import { useParams } from "next/navigation"
import { VideoCallRoom } from "@/components/video-call-room"

export default function SessionCallPage() {
  const params = useParams()
  const bookingId = params.id as string

  return <VideoCallRoom bookingId={bookingId} />
}
