import { describe, expect, it } from 'vitest'
import { InMemoryRateLimiter, NoopRateLimiter } from './rateLimiters'

const policy = { name: 'test', limit: 2, windowSeconds: 60 }

describe('InMemoryRateLimiter', () => {
    it('allows up to the limit per key within the window', async () => {
        let now = 0
        const limiter = new InMemoryRateLimiter(() => now)

        expect(await limiter.consume(policy, 'ip-1')).toEqual({ allowed: true, retryAfterSeconds: 0 })
        now = 10_000
        expect((await limiter.consume(policy, 'ip-1')).allowed).toBe(true)
        expect(await limiter.consume(policy, 'ip-1')).toEqual({ allowed: false, retryAfterSeconds: 50 })
        expect((await limiter.consume(policy, 'ip-2')).allowed).toBe(true)

        now = 60_001
        expect((await limiter.consume(policy, 'ip-1')).allowed).toBe(true)
    })

    it('keeps separate counters per policy', async () => {
        const limiter = new InMemoryRateLimiter(() => 0)
        await limiter.consume(policy, 'ip')
        await limiter.consume(policy, 'ip')

        expect((await limiter.consume({ ...policy, name: 'other' }, 'ip')).allowed).toBe(true)
    })
})

describe('NoopRateLimiter', () => {
    it('always allows', async () => {
        expect(await new NoopRateLimiter().consume()).toEqual({ allowed: true, retryAfterSeconds: 0 })
    })
})
