"use client"

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import type { UIMessage } from "ai"
import type { UserRole } from "./types"
import { communicationUsername } from "@/lib/communication-display"

export interface ProfileData {
  name: string
  username: string | null
  email: string
  image: string
  isVerified: boolean
  favorites: string[]
  languages: string[]
  skillLevel: string | null
  appRole: UserRole
}

interface AppContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  userName: string
  userAvatar: string
  isLoggedIn: boolean
  setIsLoggedIn: (v: boolean) => void
  profileData: ProfileData | null
  profileLoading: boolean
  refreshProfile: () => Promise<void>
  storedMessages: UIMessage[]
  setStoredMessages: (msgs: UIMessage[]) => void
  storedMessagesRef: React.RefObject<UIMessage[]>
  isMentorOpen: boolean
  setMentorOpen: (v: boolean) => void
  pendingMentorMessage: string | null
  setPendingMentorMessage: (msg: string | null) => void
  viewingTakumiId: string | null
  setViewingTakumiId: (id: string | null) => void
  openMentorWithTakumi: (takumiId: string, takumiName: string) => void
  // Direct messaging (API-backed)
  sendDirectMessage: (recipientExpertId: string, text: string) => Promise<{ recipientUserId?: string } | { error: string }>
  totalUnread: number
  notificationCount: number
  refreshNotificationCount: (() => void) | undefined
  // Expert search state (for proactive AI flow)
  isSearchingExperts: boolean
  setIsSearchingExperts: (v: boolean) => void
  searchResults: string[] | null
  setSearchResults: (ids: string[] | null) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function AppProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus, update: updateSession } = useSession()
  const [role, setRoleState] = useState<UserRole>("shugyo")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (sessionStatus !== "authenticated" || !session?.user) return
    setProfileLoading(true)
    try {
      const r = await fetch("/api/user/profile")
      const data = r.ok ? await r.json() : null
      if (data) {
        setRoleState((data.appRole as UserRole) || "shugyo")
        setProfileData({
          name: data.name || "",
          username: data.username ?? null,
          email: data.email || "",
          image: data.image || "",
          isVerified: data.isVerified ?? false,
          favorites: Array.isArray(data.favorites) ? data.favorites : [],
          languages: Array.isArray(data.languages) ? data.languages : [],
          skillLevel: data.skillLevel ?? null,
          appRole: (data.appRole as UserRole) || "shugyo",
        })
      }
    } catch {
      /* ignore */
    } finally {
      setProfileLoading(false)
    }
  }, [sessionStatus, session?.user])

  const refreshProfile = useCallback(async () => {
    await loadProfile()
  }, [loadProfile])

  // Sync auth state + load profile from DB
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user) {
      setIsLoggedIn(true)
      loadProfile()
    } else if (sessionStatus === "unauthenticated") {
      setIsLoggedIn(false)
      setRoleState("shugyo")
      setProfileData(null)
      setProfileLoading(false)
    }
  }, [session, sessionStatus, loadProfile])

  // Persist role to DB when changed + update session for middleware
  function setRole(newRole: UserRole) {
    setRoleState(newRole)
    if (isLoggedIn) {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appRole: newRole }),
      })
        .then((r) => (r.ok ? updateSession({ appRole: newRole }) : null))
        .catch(() => {})
    }
  }
  const [storedMessages, setStoredMessages] = useState<UIMessage[]>([])
  const storedMessagesRef = useRef<UIMessage[]>([])
  const [isMentorOpen, setMentorOpen] = useState(false)
  const [pendingMentorMessage, setPendingMentorMessage] = useState<string | null>(null)
  const [viewingTakumiId, setViewingTakumiId] = useState<string | null>(null)
  const [notificationCount, setNotificationCount] = useState(0)
  const [isSearchingExperts, setIsSearchingExperts] = useState(false)
  const [searchResults, setSearchResults] = useState<string[] | null>(null)

  const refreshNotificationCount = useCallback(() => {
    if (sessionStatus !== "authenticated" || !session?.user) return
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          const total = data.totalInboxUnread ?? data.unreadCount ?? 0
          setNotificationCount(total)
        }
      })
      .catch(() => {})
  }, [sessionStatus, session?.user])

  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user) refreshNotificationCount()
  }, [sessionStatus, session?.user, refreshNotificationCount])

  async function sendDirectMessage(recipientExpertId: string, text: string) {
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientExpertId, text }),
      })
      const data = await res.json()
      if (res.ok) return { recipientUserId: data.recipientUserId }
      return { error: data.error ?? "Fehler" }
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Fehler" }
    }
  }

  function handleSetStoredMessages(msgs: UIMessage[]) {
    storedMessagesRef.current = msgs
    setStoredMessages(msgs)
  }

  function openMentorWithTakumi(takumiId: string, takumiName: string) {
    setViewingTakumiId(takumiId)
    setPendingMentorMessage(
      `Ich interessiere mich fur eine Zusammenarbeit mit ${takumiName}. Kannst du mir helfen, mein Projekt kurz fur ihn zusammenzufassen?`
    )
    setMentorOpen(true)
  }

  const totalUnread = notificationCount

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        userName: communicationUsername(
          profileData?.username ?? (session?.user as { username?: string | null })?.username,
          "Nutzer",
        ),
        userAvatar: profileData?.image || session?.user?.image || "",
        isLoggedIn,
        profileData,
        profileLoading,
        refreshProfile,
        setIsLoggedIn,
        storedMessages,
        setStoredMessages: handleSetStoredMessages,
        storedMessagesRef,
        isMentorOpen,
        setMentorOpen,
        pendingMentorMessage,
        setPendingMentorMessage,
        viewingTakumiId,
        setViewingTakumiId,
        openMentorWithTakumi,
        sendDirectMessage,
        totalUnread,
        notificationCount,
        refreshNotificationCount,
        isSearchingExperts,
        setIsSearchingExperts,
        searchResults,
        setSearchResults,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
