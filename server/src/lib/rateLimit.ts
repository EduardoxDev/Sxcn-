/**
 * Token bucket: `capacity` burst, refilled at `refillPerSecond`.
 * Cheap enough to keep one per socket and one per (IP, action).
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  take(cost = 1): boolean {
    const t = this.now();
    this.tokens = Math.min(
      this.capacity,
      this.tokens + ((t - this.last) / 1000) * this.refillPerSecond,
    );
    this.last = t;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** Keyed buckets (e.g. per IP) with periodic cleanup of idle keys. */
export class KeyedRateLimiter {
  private readonly buckets = new Map<string, { bucket: TokenBucket; seen: number }>();
  private readonly sweep: NodeJS.Timeout;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.sweep = setInterval(() => this.cleanup(), 60_000);
    this.sweep.unref();
  }

  take(key: string, cost = 1): boolean {
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { bucket: new TokenBucket(this.capacity, this.refillPerSecond), seen: Date.now() };
      this.buckets.set(key, entry);
    }
    entry.seen = Date.now();
    return entry.bucket.take(cost);
  }

  private cleanup(): void {
    const idleFor = (this.capacity / this.refillPerSecond) * 1000 + 60_000;
    const cutoff = Date.now() - idleFor;
    for (const [key, entry] of this.buckets) if (entry.seen < cutoff) this.buckets.delete(key);
  }

  dispose(): void {
    clearInterval(this.sweep);
  }
}
