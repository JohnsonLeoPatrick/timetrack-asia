const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_ENTRIES = 10_000;

function evictExpired(now: number) {
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
  if (rateLimitStore.size > MAX_ENTRIES) {
    const overflow = rateLimitStore.size - MAX_ENTRIES;
    let i = 0;
    for (const key of rateLimitStore.keys()) {
      if (i++ >= overflow) break;
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = { windowMs: 60_000, maxRequests: 30 }
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  evictExpired(now);
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (record.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: config.maxRequests - record.count, resetAt: record.resetAt };
}

// IP-based rate limit for API routes
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `ratelimit:${ip}`;
}
