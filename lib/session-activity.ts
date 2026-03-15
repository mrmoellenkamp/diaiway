/**
 * Session Activity / Inactivity Timeout
 * - 15 min global inactivity timer
 * - lastActivity stored in cookie, checked in middleware
 * - Takumi liveStatus: Cron experts-offline setzt auf offline bei lastSeenAt > 5 Min
 */
export const INACTIVITY_TIMEOUT_SEC = 15 * 60 // 15 minutes
export const INACTIVITY_WARNING_SEC = 60 // Show warning 60 sec before expiry
export const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes (for video call)
/** Takumi: liveStatus → offline wenn lastSeenAt älter (experts-offline Cron) */
export const TAKUMI_STALE_OFFLINE_SEC = 5 * 60 // 5 minutes

export const LAST_ACTIVITY_COOKIE = "diaiway_last_activity"
