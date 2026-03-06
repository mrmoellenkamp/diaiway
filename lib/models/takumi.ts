import mongoose, { Schema, Document, Model } from "mongoose"

export interface ITakumi extends Document {
  userId?: string
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
  pricePerSession: number
  isLive: boolean
  isPro: boolean
  verified: boolean
  portfolio: string[]
  joinedDate: string
  imageUrl?: string
  matchRate?: number
}

const TakumiSchema = new Schema<ITakumi>(
  {
    userId: { type: String, default: null, index: true },
    name: { type: String, required: true },
    email: { type: String, default: "", lowercase: true, trim: true, index: true },
    avatar: { type: String, required: true },
    categorySlug: { type: String, required: true },
    categoryName: { type: String, required: true },
    subcategory: { type: String, required: true },
    bio: { type: String, required: true },
    rating: { type: Number, required: true, default: 0 },
    reviewCount: { type: Number, default: 0 },
    sessionCount: { type: Number, default: 0 },
    responseTime: { type: String, default: "< 5 Min" },
    pricePerSession: { type: Number, required: true },
    isLive: { type: Boolean, default: false },
    isPro: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    portfolio: { type: [String], default: [] },
    joinedDate: { type: String, required: true },
    imageUrl: { type: String, default: "" },
    matchRate: { type: Number, default: 0 },
  },
  { timestamps: true }
)

// Prevent model re-compilation in Next.js hot reload
const TakumiModel: Model<ITakumi> =
  mongoose.models.Takumi || mongoose.model<ITakumi>("Takumi", TakumiSchema)

export default TakumiModel
