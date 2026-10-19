export interface Clock {
    now(): Date
}

export interface IdGenerator {
    next(): string
}

export interface Page<T> {
    items: T[]
    nextCursor: string | null
}
