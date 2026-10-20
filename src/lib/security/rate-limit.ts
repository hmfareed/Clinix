interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitOptions {
  limit: number; // Max allowed requests in window
  windowSeconds: number; // Duration of window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 20, windowSeconds: 60 }
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  // Cleanup old expired entries occasionally
  if (memoryStore.size > 10000) {
    for (const [key, record] of memoryStore.entries()) {
      if (record.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }

  const existing = memoryStore.get(identifier);

  if (!existing || existing.resetAt <= now) {
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetSeconds: options.windowSeconds,
    };
  }

  if (existing.count >= options.limit) {
    const remainingSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      resetSeconds: remainingSeconds > 0 ? remainingSeconds : 1,
    };
  }

  existing.count += 1;
  const remainingSeconds = Math.ceil((existing.resetAt - now) / 1000);

  return {
    success: true,
    limit: options.limit,
    remaining: options.limit - existing.count,
    resetSeconds: remainingSeconds > 0 ? remainingSeconds : 1,
  };
}
