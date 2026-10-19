import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { RateLimiter, RateLimitPolicy, RateLimitResult } from '../application/rateLimit'

/** Sliding-window limiter shared by every serverless instance through Upstash Redis. */
export class UpstashRateLimiter implements RateLimiter {
    private readonly redis: Redis
    private readonly limiters = new Map<string, Ratelimit>()

    constructor(options: { url: string; token: string }) {
        this.redis = new Redis({ url: options.url, token: options.token })
    }

    async consume(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
        const { success, reset } = await this.limiterFor(policy).limit(key)
        return {
            allowed: success,
            retryAfterSeconds: success ? 0 : Math.max(1, Math.ceil((reset - Date.now()) / 1000))
        }
    }

    private limiterFor(policy: RateLimitPolicy): Ratelimit {
        let limiter = this.limiters.get(policy.name)
        if (!limiter) {
            limiter = new Ratelimit({
                redis: this.redis,
                limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
                prefix: `ratelimit:${policy.name}`
            })
            this.limiters.set(policy.name, limiter)
        }
        return limiter
    }
}

/** Used when Upstash is not configured (local development and tests). */
export class NoopRateLimiter implements RateLimiter {
    async consume(): Promise<RateLimitResult> {
        return { allowed: true, retryAfterSeconds: 0 }
    }
}

/** Counts in memory. Only for tests: each serverless instance would have its own counters. */
export class InMemoryRateLimiter implements RateLimiter {
    private readonly hits = new Map<string, number[]>()

    constructor(private readonly now: () => number = Date.now) {}

    async consume(policy: RateLimitPolicy, key: string): Promise<RateLimitResult> {
        const id = `${policy.name}:${key}`
        const windowStart = this.now() - policy.windowSeconds * 1000
        const recent = (this.hits.get(id) ?? []).filter(time => time > windowStart)

        if (recent.length >= policy.limit) {
            this.hits.set(id, recent)
            const retryAfterMs = recent[0]! + policy.windowSeconds * 1000 - this.now()
            return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) }
        }

        this.hits.set(id, [...recent, this.now()])
        return { allowed: true, retryAfterSeconds: 0 }
    }
}
