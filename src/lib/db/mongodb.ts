import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/clinix";

export class DatabaseUnavailableError extends Error {
  constructor(message = "Database is currently unavailable or unreachable.") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  lastFailureTime?: number;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached = global.mongooseCache;

if (!cached) {
  cached = global.mongooseCache = { conn: null, promise: null };
}

/**
 * Returns true if the Mongoose connection is actively connected (readyState === 1)
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Safe connection check: attempts connection with cooldown if previously failed.
 * Returns true if connected, false if database is offline or unreachable.
 */
export async function tryConnectToDatabase(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  // Fast-fail if a failure occurred within the last 15 seconds to avoid UI hang
  if (cached!.lastFailureTime && Date.now() - cached!.lastFailureTime < 15000) {
    return false;
  }

  try {
    await connectToDatabase();
    return true;
  } catch (err: unknown) {
    console.warn("[MongoDB] Database connection unavailable:", (err as Error)?.message || err);
    return false;
  }
}

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cached!.conn && mongoose.connection.readyState === 1) {
    return cached!.conn;
  }

  // If a recent failure occurred, avoid long timeout stalls
  if (cached!.lastFailureTime && Date.now() - cached!.lastFailureTime < 15000) {
    throw new DatabaseUnavailableError("MongoDB is offline or unreachable (cooldown active).");
  }

  if (!cached!.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 2500, // Fast 2.5s timeout for local development/offline detection
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      cached!.lastFailureTime = undefined;
      return mongooseInstance;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    cached!.conn = null;
    cached!.lastFailureTime = Date.now();
    throw e;
  }

  return cached!.conn;
}

export default connectToDatabase;
