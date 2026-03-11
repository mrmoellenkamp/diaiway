"use client"

import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import type { UIMessage } from "ai"
import type { UserRole } from "./types"

interface AppContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  userName: string
  userAvatar: string
  isLoggedIn: boolean
  setIsLoggedIn: (v: boolean) => void
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

  // Sync auth state + appRole from session / DB
  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user) {
      setIsLoggedIn(true)
      // Load persisted appRole from DB
      fetch("/api/user/profile")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.appRole) setRoleState(data.appRole)
        })
        .catch(() => {})
    } else if (sessionStatus === "unauthenticated") {
      setIsLoggedIn(false)
      setRoleState("shugyo")
    }
  }, [session, sessionStatus])

  // Persist role to DB when changed + update session for middleware
  function setRole(newRole: UserRole) {
    setRoleState(newRole)
    if (isLoggedIn) {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appRole: newRole }),
      })
        .then((r) => r.ok && updateSession({ appRole: newRole }))
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

  function refreshNotificationCount() {
    if (sessionStatus !== "authenticated" || !session?.user) return
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setNotificationCount(data.unreadCount ?? 0))
      .catch(() => {})
  }

  useEffect(() => {
    if (sessionStatus === "authenticated" && session?.user) refreshNotificationCount()
  }, [sessionStatus, session?.user])

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
        userName: session?.user?.name || "Nutzer",
        userAvatar: session?.user?.image || "",
        isLoggedIn,
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
