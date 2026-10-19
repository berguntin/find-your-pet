import type { OutboxEntry, OutboxStore } from '../application/outbox'
import type { RecordedEvent } from '../domain/events'
import type { Database } from './database'

/** How long a claimed event stays reserved for the processor that claimed it. */
const LEASE_MS = 2 * 60 * 1000

interface OutboxRow {
    id: string
    type: string
    payload: Record<string, unknown>
    occurred_at: Date
    attempts: number
}

/**
 * Inserts events inside the caller's transaction, so they are stored only if the change is.
 * They become available at the time they occurred, using the app clock like `claim` does.
 */
export async function appendToOutbox(sql: Database, events: RecordedEvent[]): Promise<void> {
    for (const event of events) {
        await sql`
            insert into outbox (type, payload, occurred_at, available_at)
            values (${event.type}, ${sql.json(event.payload as never)}, ${event.occurredAt}, ${event.occurredAt})
        `
    }
}

export class PostgresOutboxStore implements OutboxStore {
    constructor(private readonly sql: Database) {}

    async claim(limit: number, now: Date): Promise<OutboxEntry[]> {
        const rows = await this.sql<OutboxRow[]>`
            update outbox set available_at = ${new Date(now.getTime() + LEASE_MS)}
            where id in (
                select id from outbox
                where processed_at is null and dead_at is null and available_at <= ${now}
                order by available_at
                limit ${limit}
                for update skip locked
            )
            returning id, type, payload, occurred_at, attempts
        `
        return rows.map(row => ({
            event: { id: row.id, type: row.type, payload: row.payload, occurredAt: row.occurred_at },
            attempts: row.attempts
        }))
    }

    async complete(eventId: string, now: Date): Promise<void> {
        await this.sql`update outbox set processed_at = ${now}, last_error = null where id = ${eventId}`
    }

    async fail(eventId: string, error: string, retryAt: Date | null): Promise<void> {
        await this.sql`
            update outbox set
                attempts = attempts + 1,
                last_error = ${error.slice(0, 2000)},
                available_at = coalesce(${retryAt}, available_at),
                dead_at = ${retryAt ? null : new Date()}
            where id = ${eventId}
        `
    }
}
