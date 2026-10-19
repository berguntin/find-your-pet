import { timingSafeEqual } from 'node:crypto'
import { consola } from 'consola'
import {
    defineEventHandler,
    getHeader,
    getRequestIP,
    isError,
    setResponseHeader,
    setResponseStatus,
    type H3Event
} from 'h3'
import type { ZodType, ZodTypeDef } from 'zod'
import type { ApiErrorDto } from '../../../contracts/pets'
import type { RateLimiter, RateLimitPolicy } from '../application/rateLimit'
import type { Actor } from '../domain/actor'
import { DomainError, ValidationError, type DomainErrorCode } from '../domain/errors'

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
    validation: 422,
    content_rejected: 422,
    not_found: 404,
    forbidden: 403,
    conflict: 409
}

/** HTTP-only errors: they are not part of the domain. */
export class RateLimitedError extends Error {
    constructor(readonly retryAfterSeconds: number) {
        super('Too many requests, please try again later')
    }
}

export class UnauthorizedError extends Error {
    constructor() {
        super('Missing or invalid credentials')
    }
}

/**
 * Wraps a handler so domain errors become `{ error: { code, message, details } }` responses
 * with the right status code, and unexpected errors are logged and hidden from the client.
 */
export function defineApiHandler<T>(handler: (event: H3Event) => Promise<T> | T) {
    return defineEventHandler(async event => {
        try {
            return await handler(event)
        } catch (error) {
            return toErrorResponse(event, error)
        }
    })
}

export function parseWith<Output, Input>(schema: ZodType<Output, ZodTypeDef, Input>, value: unknown): Output {
    const result = schema.safeParse(value)
    if (!result.success) {
        throw new ValidationError('Invalid request', {
            issues: result.error.issues.map(issue => ({ path: issue.path.join('.'), message: issue.message }))
        })
    }
    return result.data
}

/** Until Google login exists the only privileged actor is an admin using `Authorization: Bearer <token>`. */
export function getActor(event: H3Event, adminToken: string | undefined): Actor {
    if (adminToken && hasBearerToken(event, adminToken)) return { kind: 'admin' }
    return { kind: 'anonymous' }
}

/** Guards internal endpoints (outbox processing, cleanups) called by schedulers. */
export function requireBearerToken(event: H3Event, tokens: (string | undefined)[]): void {
    if (!tokens.some(token => token && hasBearerToken(event, token))) throw new UnauthorizedError()
}

/** Counts the request against `policy` for the client IP and rejects it with 429 when over the limit. */
export async function enforceRateLimit(event: H3Event, limiter: RateLimiter, policy: RateLimitPolicy): Promise<void> {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const { allowed, retryAfterSeconds } = await limiter.consume(policy, ip)
    if (!allowed) throw new RateLimitedError(retryAfterSeconds)
}

function hasBearerToken(event: H3Event, expected: string): boolean {
    const header = getHeader(event, 'authorization')
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null
    return token !== null && safeEqual(token, expected)
}

function toErrorResponse(event: H3Event, error: unknown): ApiErrorDto {
    if (error instanceof DomainError) {
        setResponseStatus(event, STATUS_BY_CODE[error.code])
        return { error: { code: error.code, message: error.message, details: error.details } }
    }
    if (error instanceof RateLimitedError) {
        setResponseStatus(event, 429)
        setResponseHeader(event, 'Retry-After', error.retryAfterSeconds)
        return { error: { code: 'rate_limited', message: error.message } }
    }
    if (error instanceof UnauthorizedError) {
        setResponseStatus(event, 401)
        return { error: { code: 'unauthorized', message: error.message } }
    }
    // Errors raised by h3 itself, such as a malformed JSON body.
    if (isError(error) && error.statusCode < 500) {
        setResponseStatus(event, 400)
        return { error: { code: 'validation', message: error.statusMessage || 'Bad request' } }
    }

    consola.error(error)
    setResponseStatus(event, 500)
    return { error: { code: 'internal', message: 'Unexpected error, please try again later' } }
}

function safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a)
    const right = Buffer.from(b)
    return left.length === right.length && timingSafeEqual(left, right)
}
