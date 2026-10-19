export type DomainErrorCode = 'validation' | 'not_found' | 'forbidden' | 'conflict'

export class DomainError extends Error {
    constructor(
        readonly code: DomainErrorCode,
        message: string,
        readonly details?: Record<string, unknown>
    ) {
        super(message)
        this.name = new.target.name
    }
}

export class ValidationError extends DomainError {
    constructor(message: string, details?: Record<string, unknown>) {
        super('validation', message, details)
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
