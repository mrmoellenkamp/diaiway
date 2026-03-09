export type UserRole = "shugyo" | "takumi"

export interface CancelPolicy {
  freeHours: number   // free cancellation up to X hours before session
  feePercent: number  // % of booking fee retained after free window (0–100)
}

export interface SocialLinks {
  instagram?: string
  tiktok?: string
  facebook?: string
  youtube?: string
  linkedin?: string
  x?: string
  website?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  avatar: string
  bio?: string
  joinedDate: string
}

export interface Takumi {
  id: string
  name: string
  email?: string
  avatar: string
  categorySlug: string
  categoryName: string
  subcategory: string
  bio: string
  rating: number
  reviewCount: number
  sessionCount: number
  responseTime: string
  priceVideo15Min?: number
  priceVoice15Min?: number
  pricePerSession?: number
  isLive: boolean
  isPro: boolean
  verified: boolean
  portfolio: string[]
  joinedDate: string
  imageUrl?: string
  socialLinks?: SocialLinks
  cancelPolicy?: CancelPolicy
}

export interface Category {
  slug: string
  name: string
  icon: string
  description: string
  subcategories: string[]
  takumiCount: number
  color: string
}

export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "declined" | "cancelled"
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed"
export type CallType = "VIDEO" | "VOICE"

export interface BookingRecord {
  id: string         // Prisma CUID (was _id in Mongo)
  expertId: string
  expertName: string
  expertEmail: string
  userId: string
  userName: string
  userEmail: string
  date: string
  startTime: string
  endTime: string
  status: BookingStatus
  callType?: CallType
  totalPrice?: number
  price?: number
  note?: string
  sessionStartedAt?: string
  sessionEndedAt?: string
  sessionDuration?: number
  trialUsed?: boolean
  // Payment
  paymentStatus: PaymentStatus
  stripeSessionId?: string
  stripePaymentIntentId?: string
  paidAt?: string
  paidAmount?: number
  createdAt: string
  updatedAt: string
  // Populated from Expert join
  takumiAvatar?: string
  takumiSubcategory?: string
  // Legacy aliases kept for backwards compatibility in booking-card
  takumiName: string
  takumiEmail: string
  takumiId: string
  // Role: true if current user is the Takumi (expert) for this booking
  isExpert?: boolean
  // Für Takumi: Shugyo Kenntnisstufe + Projektbilder
  shugyoSkillLevel?: string | null
  shugyoProjects?: { id: string; title: string; description: string; imageUrl: string }[]
  // Cancellation
  cancelledBy?: string
  cancelFeeAmount?: number
  cancelledAt?: string
  cancelPreview?: {
    isFree: boolean
    hoursUntilSession: number
    freeHours: number
    feePercent: number
    feeAmount: number
    refundAmount: number
  }
  _id?: string  // legacy alias
}

export interface Session {
  id: string
  takumi: Takumi
  status: "active" | "upcoming" | "completed" | "cancelled"
  scheduledAt: string
  duration: number
  price: number
  rating?: number
  review?: string
  category: string
}

export interface Review {
  id: string
  authorName: string
  authorAvatar: string
  rating: number
  text: string
  date: string
}

export interface AiMessage {
  id: string
  role: "user" | "assistant"
  content: string
  image?: string
  suggestions?: TakumiSuggestion[]
}

export interface TakumiSuggestion {
  takumiId: string
  name: string
  match: number
  reason: string
}

export interface DirectMessage {
  id: string
  text: string
  sender: "user" | "takumi"
  timestamp: number
}

export interface DirectThread {
  takumiId: string
  takumiName: string
  takumiAvatar: string
  subcategory: string
  messages: DirectMessage[]
  unread: number
}

export type ProjectPhase = "analyse" | "planung" | "umsetzung" | "abnahme"

export interface ProjectMessage {
  id: string
  sender: "user" | "ai" | "takumi"
  content: string
  image?: string
  timestamp: string
}

export interface Project {
  id: string
  title: string
  takumiId: string
  takumiName: string
  takumiAvatar: string
  phase: ProjectPhase
  status: string
  messages: ProjectMessage[]
  createdAt: string
}
