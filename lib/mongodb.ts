import mongoose from "mongoose"

// Read at runtime, not module-load time, to avoid crashing during client builds
function getUri(): string {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error(
      "MONGODB_URI ist nicht gesetzt. Bitte in den Projekt-Einstellungen unter 'Vars' hinzufuegen."
    )
  }
  return uri
}

/**
 * Global cache to preserve the Mongoose connection across hot reloads
 * in Next.js development mode (prevents opening too many connections).
 */
interface MongoCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongoCache | undefined
}

const cached: MongoCache = global._mongooseCache ?? { conn: null, promise: null }
if (!global._mongooseCache) {
  global._mongooseCache = cached
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(getUri(), {
      bufferCommands: false,
    })
  }

  cached.conn = await cached.promise
  return cached.conn
}
