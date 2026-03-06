import mongoose, { Schema, Document, Model } from "mongoose"

export type BookingStatus = "pending" | "confirmed" | "active" | "completed" | "declined" | "cancelled"
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "failed"

export interface IBooking extends Document {
  takumiId: string
  takumiName: string
  takumiEmail: string
  userId: string
  userName: string
  userEmail: string
  date: string        // YYYY-MM-DD
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  status: BookingStatus
  price: number       // price per 30min in cents
  note?: string
  statusToken: string // secret token for accept/decline email links
  
  // Video-Session fields
  dailyRoomUrl?: string
  sessionStartedAt?: Date
  sessionEndedAt?: Date
  sessionDuration?: number // effective duration in minutes
  trialUsed?: boolean      // whether 5-min free trial was used
  
  // Payment fields (Stripe)
  paymentStatus: PaymentStatus
  stripeSessionId?: string
  stripePaymentIntentId?: string
  paidAt?: Date
  paidAmount?: number      // actual amount paid in cents
  
  createdAt: Date
  updatedAt: Date
}

const BookingSchema = new Schema<IBooking>(
  {
    takumiId:    { type: String, required: true, index: true },
    takumiName:  { type: String, required: true },
    takumiEmail: { type: String, required: false, default: "" },
    userId:      { type: String, required: true, index: true },
    userName:    { type: String, required: true },
    userEmail:   { type: String, required: true },
    date:        { type: String, required: true },
    startTime:   { type: String, required: true },
    endTime:     { type: String, required: true },
    status:      { type: String, enum: ["pending", "confirmed", "active", "completed", "declined", "cancelled"], default: "pending" },
    price:       { type: Number, required: true },
    note:        { type: String, default: "" },
    statusToken: { type: String, required: true, index: true },
    dailyRoomUrl:     { type: String, default: "" },
    sessionStartedAt: { type: Date },
    sessionEndedAt:   { type: Date },
    sessionDuration:  { type: Number },
    trialUsed:        { type: Boolean, default: false },
    
    // Payment
    paymentStatus:         { type: String, enum: ["unpaid", "pending", "paid", "refunded", "failed"], default: "unpaid" },
    stripeSessionId:       { type: String },
    stripePaymentIntentId: { type: String },
    paidAt:                { type: Date },
    paidAmount:            { type: Number },
  },
  { timestamps: true }
)

// Compound index: fast lookup of taken time slots per takumi per date
BookingSchema.index({ takumiId: 1, date: 1, status: 1 })

// In dev/HMR, the model can retain an old schema. Ensure we don't keep stale validation rules.
if (process.env.NODE_ENV === "development" && mongoose.models.Booking) {
  delete mongoose.models.Booking
}

const BookingModel: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>("Booking", BookingSchema)

export default BookingModel
