export type DomainErrorCode = 'validation' | 'content_rejected' | 'not_found' | 'forbidden' | 'conflict'

export class DomainError extends Error {
    constructor(readonly code: DomainErrorCode, message: string, readonly details?: Record<string, unknown>) {
        super(message)
        this.name = new.target.name
    }
}

export class ValidationError extends DomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super('validation', message, details)
    }
}

/** The content is valid but not acceptable for the site (not a pet report, offensive...). */
export class ContentRejectedError extends DomainError {
    constructor(message = 'The report does not look like a lost or found pet') {
        super('content_rejected', message)
    }
}

export class NotFoundError extends DomainError {
    constructor(message: string) {
        super('not_found', message)
    }
}

export class ForbiddenError extends DomainError {
    constructor(message = 'You are not allowed to perform this action') {
        super('forbidden', message)
    }
}

export class ConflictError extends DomainError {
    constructor(message: string) {
        super('conflict', message)
    }
}
