export interface RateLimitPolicy {
    /** Identifies the counter, e.g. `describe`. */
    name: string
    limit: number
    windowSeconds: number
}

export interface RateLimitResult {
    allowed: boolean
    /** Seconds until a new request is allowed; 0 when allowed. */
    retryAfterSeconds: number
}

export interface RateLimiter {
    consume(policy: RateLimitPolicy, key: string): Promise<RateLimitResult>
}

/** Limits for endpoints that cost money (AI calls) or can be abused, per client IP. */
export const RATE_LIMITS = {
    describe: { name: 'describe', limit: 10, windowSeconds: 10 * 60 },
    reportPet: { name: 'report-pet', limit: 10, windowSeconds: 60 * 60 },
    uploadSignature: { name: 'upload-signature', limit: 60, windowSeconds: 60 * 60 }
} as const satisfies Record<string, RateLimitPolicy>
