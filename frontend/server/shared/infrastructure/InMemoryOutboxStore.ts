import { randomUUID } from 'node:crypto'
import type { OutboxEntry, OutboxStore } from '../application/outbox'
import type { DomainEvent, RecordedEvent } from '../domain/events'

interface StoredEvent {
    event: DomainEvent
    attempts: number
    availableAt: Date
    processedAt: Date | null
    deadAt: Date | null
    lastError: string | null
}

/** Test double for the outbox. */
export class InMemoryOutboxStore implements OutboxStore {
    readonly events: StoredEvent[] = []

    append(events: RecordedEvent[]): void {
        for (const event of events) {
            this.events.push({
                event: { ...event, id: randomUUID() },
                attempts: 0,
                availableAt: event.occurredAt,
                processedAt: null,
                deadAt: null,
                lastError: null
            })
        }
    }

    pending(): DomainEvent[] {
        return this.events.filter(e => !e.processedAt && !e.deadAt).map(e => e.event)
    }

    async claim(limit: number, now: Date): Promise<OutboxEntry[]> {
        const claimed = this.events
            .filter(e => !e.processedAt && !e.deadAt && e.availableAt <= now)
            .slice(0, limit)
        claimed.forEach(e => (e.availableAt = new Date(now.getTime() + 2 * 60 * 1000)))
        return claimed.map(({ event, attempts }) => ({ event, attempts }))
    }

    async complete(eventId: string, now: Date): Promise<void> {
        const stored = this.find(eventId)
        stored.processedAt = now
        stored.lastError = null
    }

    async fail(eventId: string, error: string, retryAt: Date | null): Promise<void> {
        const stored = this.find(eventId)
        stored.attempts++
        stored.lastError = error
        if (retryAt) stored.availableAt = retryAt
        else stored.deadAt = new Date()
    }

    private find(eventId: string): StoredEvent {
        const stored = this.events.find(e => e.event.id === eventId)
        if (!stored) throw new Error(`Unknown event ${eventId}`)
        return stored
    }
}
