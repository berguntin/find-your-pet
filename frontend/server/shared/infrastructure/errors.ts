/** Errors that only make sense at the edges (HTTP, external services): they are not part of the domain. */

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

/** A feature that depends on an external service that is not configured or not reachable. */
export class ServiceUnavailableError extends Error {}
