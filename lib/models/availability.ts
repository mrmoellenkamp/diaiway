import mongoose, { Schema, Document, Model } from "mongoose"

export interface ITimeSlot {
  start: string // "08:00"
  end: string   // "12:00"
}

/** Weekly slots: default schedule for each weekday */
export type WeeklySlots = {
  0: ITimeSlot[] // Sonntag
  1: ITimeSlot[] // Montag
  2: ITimeSlot[] // Dienstag
  3: ITimeSlot[] // Mittwoch
  4: ITimeSlot[] // Donnerstag
  5: ITimeSlot[] // Freitag
  6: ITimeSlot[] // Samstag
}

/** A rule that applies for a range of calendar weeks */
export interface IWeeklyRule {
  name: string           // e.g. "Normaler Zeitraum", "Sommerferien"
  startWeek: number      // KW start (1-53)
  endWeek: number        // KW end (1-53)
  year?: number          // optional: specific year, or applies to all years
  slots: WeeklySlots
}

/** An exception for a specific date (overrides rules) */
export interface IDateException {
  date: string           // YYYY-MM-DD
  reason: string         // e.g. "Urlaub", "Feiertag", "Spezieller Termin"
  type: "unavailable" | "custom"
  slots?: ITimeSlot[]    // if type is "custom", use these slots; if "unavailable", no slots
}

export interface IAvailability extends Document {
  takumiId: string // references User._id
  
  /** Default weekly slots (backwards compatible) */
  slots: WeeklySlots
  
  /** Yearly rules: different schedules for different week ranges */
  yearlyRules: IWeeklyRule[]
  
  /** Date-specific exceptions (vacations, holidays, special days) */
  exceptions: IDateException[]
  
  updatedAt: Date
}

const TimeSlotSchema = new Schema<ITimeSlot>(
  { start: { type: String, required: true }, end: { type: String, required: true } },
  { _id: false }
)

const WeeklySlotsSchema = {
  0: { type: [TimeSlotSchema], default: [] },
  1: { type: [TimeSlotSchema], default: [] },
  2: { type: [TimeSlotSchema], default: [] },
  3: { type: [TimeSlotSchema], default: [] },
  4: { type: [TimeSlotSchema], default: [] },
  5: { type: [TimeSlotSchema], default: [] },
  6: { type: [TimeSlotSchema], default: [] },
}

const WeeklyRuleSchema = new Schema<IWeeklyRule>(
  {
    name: { type: String, required: true },
    startWeek: { type: Number, required: true, min: 1, max: 53 },
    endWeek: { type: Number, required: true, min: 1, max: 53 },
    year: { type: Number },
    slots: { type: WeeklySlotsSchema, required: true },
  },
  { _id: false }
)

const DateExceptionSchema = new Schema<IDateException>(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    reason: { type: String, required: true },
    type: { type: String, enum: ["unavailable", "custom"], default: "unavailable" },
    slots: { type: [TimeSlotSchema], default: [] },
  },
  { _id: false }
)

const AvailabilitySchema = new Schema<IAvailability>(
  {
    takumiId: { type: String, required: true, unique: true },
    slots: { type: WeeklySlotsSchema, default: () => ({ 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }) },
    yearlyRules: { type: [WeeklyRuleSchema], default: [] },
    exceptions: { type: [DateExceptionSchema], default: [] },
  },
  { timestamps: true }
)

const AvailabilityModel: Model<IAvailability> =
  mongoose.models.Availability || mongoose.model<IAvailability>("Availability", AvailabilitySchema)

export default AvailabilityModel

/** Get ISO week number for a date */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/** Resolve effective slots for a specific date, considering rules and exceptions */
export function resolveSlots(
  avail: IAvailability | null,
  dateStr: string // YYYY-MM-DD
): ITimeSlot[] {
  if (!avail) return []
  
  const date = new Date(dateStr + "T00:00:00")
  const dayOfWeek = date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const week = getISOWeek(date)
  const year = date.getFullYear()
  
  // 1. Check for date-specific exception
  const exception = avail.exceptions.find((e) => e.date === dateStr)
  if (exception) {
    if (exception.type === "unavailable") return []
    return exception.slots || []
  }
  
  // 2. Check for matching yearly rule (year-specific first, then generic)
  const yearSpecificRule = avail.yearlyRules.find(
    (r) => r.year === year && week >= r.startWeek && week <= r.endWeek
  )
  if (yearSpecificRule) {
    return yearSpecificRule.slots[dayOfWeek] || []
  }
  
  const genericRule = avail.yearlyRules.find(
    (r) => !r.year && week >= r.startWeek && week <= r.endWeek
  )
  if (genericRule) {
    return genericRule.slots[dayOfWeek] || []
  }
  
  // 3. Fall back to default weekly slots
  return avail.slots[dayOfWeek] || []
}
