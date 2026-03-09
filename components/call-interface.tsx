"use client"

import { useEffect, useRef } from "react"
import { Mic, MicOff, Video, VideoOff, PhoneOff, SwitchCamera, Flag } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useDailyCall, type CallMode } from "@/hooks/use-daily-call"
import { useI18n } from "@/lib/i18n"

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

interface CallInterfaceProps {
  roomUrl: string
  callMode: CallMode
  takumiName: string
  isVoice: boolean
  onLeave: () => void
  onReportAndLeave: () => void
}

export function CallInterface({
  roomUrl,
  callMode,
  takumiName,
  isVoice,
  onLeave,
  onReportAndLeave,
}: CallInterfaceProps) {
  const { t } = useI18n()
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)

  const {
    isJoined,
    isMuted,
    isVideoOn,
    isPartnerSpeaking,
    error,
    localVideoTrack,
    remoteVideoTrack,
    join,
    leave,
    cycleCamera,
    toggleMute,
    toggleVideo,
  } = useDailyCall({ roomUrl, callMode })

  // Join on mount when we have roomUrl
  useEffect(() => {
    if (roomUrl && !isJoined && !error) join()
  }, [roomUrl, isJoined, error, join])

  // Attach video tracks to elements
  useEffect(() => {
    if (localVideoRef.current && localVideoTrack) {
      const stream = new MediaStream([localVideoTrack])
      localVideoRef.current.srcObject = stream
      return () => {
        localVideoRef.current && (localVideoRef.current.srcObject = null)
      }
    }
  }, [localVideoTrack])

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoTrack) {
      const stream = new MediaStream([remoteVideoTrack])
      remoteVideoRef.current.srcObject = stream
      return () => {
        remoteVideoRef.current && (remoteVideoRef.current.srcObject = null)
      }
    }
  }, [remoteVideoTrack])

  const handleLeave = async () => {
    await leave()
    onLeave()
  }

  const initials = getInitials(takumiName)

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary to-emerald-800 p-6">
        <p className="text-center text-sm font-medium text-primary-foreground">{error.message}</p>
        <button
          onClick={() => join()}
          className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-white/30"
        >
          {t("video.retryJoin")}
        </button>
      </div>
    )
  }

  // Joining / loading
  if (!isJoined) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-gradient-to-br from-primary to-emerald-800 p-6">
        <div className="flex size-20 items-center justify-center rounded-full bg-white/20">
          <Video className="size-10 text-primary-foreground animate-pulse" />
        </div>
        <p className="text-center text-sm font-medium text-primary-foreground">
          {t("video.roomPreparing")}
        </p>
      </div>
    )
  }

  // Voice mode: large avatar + pulse when partner speaks
  if (isVoice) {
    return (
      <div className="relative flex flex-1 flex-col items-center justify-center bg-gradient-to-br from-primary to-emerald-800 p-6">
        <div
          className={`relative flex size-40 items-center justify-center rounded-full transition-all duration-300 ${
            isPartnerSpeaking
              ? "animate-[pulse_1.2s_ease-in-out_infinite] ring-4 ring-accent/60 ring-offset-4 ring-offset-transparent"
              : "ring-2 ring-white/20"
          }`}
        >
          <Avatar className="size-36 border-4 border-white/30">
            <AvatarFallback className="bg-white/20 text-3xl font-bold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
        <p className="mt-4 text-lg font-semibold text-primary-foreground">{takumiName}</p>
        {isPartnerSpeaking && (
          <p className="mt-1 text-xs text-primary-foreground/80">{t("video.partnerSpeaking")}</p>
        )}
        <Controls
          isVoice
          isMuted={isMuted}
          isVideoOn={isVideoOn}
          onMute={toggleMute}
          onVideo={toggleVideo}
          onFlip={() => {}}
          onLeave={handleLeave}
          onReport={onReportAndLeave}
          t={t}
        />
      </div>
    )
  }

  // Video mode: remote fullscreen, local PiP, flip button
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-foreground">
      {/* Remote video (fullscreen) */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/20 to-emerald-900/20">
        {remoteVideoTrack ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Avatar className="size-28 border-4 border-white/20">
              <AvatarFallback className="bg-primary/20 text-2xl font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <p className="text-sm font-medium text-primary-foreground/80">{takumiName}</p>
            <p className="text-xs text-primary-foreground/60">{t("video.waitingForVideo")}</p>
          </div>
        )}
      </div>

      {/* Local video PiP */}
      <div className="absolute right-4 top-20 z-10 aspect-video w-24 overflow-hidden rounded-xl border-2 border-white/30 bg-black shadow-xl">
        {localVideoTrack && isVideoOn ? (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary/30">
            <VideoOff className="size-6 text-primary-foreground/60" />
          </div>
        )}
      </div>

      <Controls
        isVoice={false}
        isMuted={isMuted}
        isVideoOn={isVideoOn}
        onMute={toggleMute}
        onVideo={toggleVideo}
        onFlip={cycleCamera}
        onLeave={handleLeave}
        onReport={onReportAndLeave}
        t={t}
      />
    </div>
  )
}

function Controls({
  isVoice,
  isMuted,
  isVideoOn,
  onMute,
  onVideo,
  onFlip,
  onLeave,
  onReport,
  t,
}: {
  isVoice: boolean
  isMuted: boolean
  isVideoOn: boolean
  onMute: () => void
  onVideo: () => void
  onFlip: () => void
  onLeave: () => void
  onReport: () => void
  t: (key: string) => string
}) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pb-8 pt-12">
      <div className="mx-auto flex max-w-xs items-center justify-around">
        <button
          onClick={onMute}
          className={`flex size-14 items-center justify-center rounded-full transition-colors ${
            isMuted ? "bg-destructive" : "bg-white/20"
          }`}
          aria-label={isMuted ? t("video.unmuteAria") : t("video.muteAria")}
        >
          {isMuted ? (
            <MicOff className="size-6 text-destructive-foreground" />
          ) : (
            <Mic className="size-6 text-primary-foreground" />
          )}
        </button>

        {!isVoice && (
          <>
            <button
              onClick={onVideo}
              className={`flex size-14 items-center justify-center rounded-full transition-colors ${
                !isVideoOn ? "bg-destructive" : "bg-white/20"
              }`}
              aria-label={isVideoOn ? t("video.camOff") : t("video.camOn")}
            >
              {isVideoOn ? (
                <Video className="size-6 text-primary-foreground" />
              ) : (
                <VideoOff className="size-6 text-destructive-foreground" />
              )}
            </button>
            <button
              onClick={onFlip}
              className="flex size-14 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
              aria-label={t("video.flipCamera")}
            >
              <SwitchCamera className="size-6 text-primary-foreground" />
            </button>
          </>
        )}

        <button
          onClick={onLeave}
          className="flex size-16 items-center justify-center rounded-full bg-destructive shadow-lg transition-transform active:scale-95"
          aria-label={t("video.endCall")}
        >
          <PhoneOff className="size-7 text-destructive-foreground" />
        </button>

        <button
          onClick={onReport}
          className="flex size-14 items-center justify-center rounded-full bg-white/20 transition-colors hover:bg-white/30"
          aria-label={t("safety.reportAndLeave")}
          title={t("safety.reportAndLeaveDesc")}
        >
          <Flag className="size-6 text-primary-foreground" />
        </button>
      </div>
    </div>
  )
}
