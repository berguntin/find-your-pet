import type { DomainEvent } from '../domain/events'
import type { Clock } from './ports'

export interface OutboxEntry {
    event: DomainEvent
    attempts: number
}

export interface OutboxStore {
    /**
     * Leases up to `limit` pending events so concurrent processors do not pick the same ones.
     * A leased event that is neither completed nor failed becomes available again after the lease.
     */
    claim(limit: number, now: Date): Promise<OutboxEntry[]>
    complete(eventId: string, now: Date): Promise<void>
    /** `retryAt: null` gives up on the event (it stays stored for inspection). */
    fail(eventId: string, error: string, retryAt: Date | null): Promise<void>
}

export type EventHandler = (event: DomainEvent) => Promise<void>

/** Maps event types to the handlers that react to them. */
export class EventHandlerRegistry {
    private readonly handlers = new Map<string, EventHandler[]>()

    on(type: string, handler: EventHandler): this {
        this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler])
        return this
    }

    handlersFor(type: string): EventHandler[] {
        return this.handlers.get(type) ?? []
    }
}

export interface ProcessOutboxResult {
    processed: number
    failed: number
}

const MAX_ATTEMPTS = 8
const BASE_RETRY_SECONDS = 60

/**
 * Delivers stored events to their handlers. Handlers must be idempotent: an event can be delivered
 * more than once if a run dies between handling it and marking it as completed.
 */
export class ProcessOutbox {
    constructor(
        private readonly outbox: OutboxStore,
        private readonly registry: EventHandlerRegistry,
        private readonly clock: Clock
    ) {}

    async execute(batchSize = 20): Promise<ProcessOutboxResult> {
        const entries = await this.outbox.claim(batchSize, this.clock.now())
        let failed = 0

        for (const { event, attempts } of entries) {
            try {
                for (const handler of this.registry.handlersFor(event.type)) await handler(event)
                await this.outbox.complete(event.id, this.clock.now())
            } catch (error) {
                failed++
                const nextAttempt = attempts + 1
                await this.outbox.fail(
                    event.id,
                    error instanceof Error ? error.message : String(error),
                    nextAttempt >= MAX_ATTEMPTS ? null : this.retryAt(nextAttempt)
                )
            }
        }

        return { processed: entries.length - failed, failed }
    }

    /** Exponential backoff: 1, 2, 4, 8... minutes. */
    private retryAt(attempt: number): Date {
        return new Date(this.clock.now().getTime() + BASE_RETRY_SECONDS * 1000 * 2 ** (attempt - 1))
    }
}
