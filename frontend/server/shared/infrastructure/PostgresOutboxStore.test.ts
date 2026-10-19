import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from './database'
import { appendToOutbox, PostgresOutboxStore } from './PostgresOutboxStore'

/** Integration tests: run only with TEST_DATABASE_URL (a migrated, disposable database). */
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresOutboxStore', () => {
    const sql = createDatabase(url!)
    const store = new PostgresOutboxStore(sql)
    const now = new Date('2026-10-19T10:00:00Z')

    const append = (type = 'pet.published') =>
        appendToOutbox(sql, [{ type, occurredAt: now, payload: { petId: 'pet-1' } }])

    beforeEach(async () => {
        await sql`delete from outbox`
    })

    afterAll(async () => {
        await sql.end()
    })

    it('claims pending events with their payload and leases them', async () => {
        await append()

        const [entry] = await store.claim(10, now)

        expect(entry).toMatchObject({
            attempts: 0,
            event: { type: 'pet.published', payload: { petId: 'pet-1' }, occurredAt: now }
        })
        // Leased for a while: another run does not get it.
        expect(await store.claim(10, now)).toEqual([])
        expect(await store.claim(10, new Date(now.getTime() + 3 * 60 * 1000))).toHaveLength(1)
    })

    it('respects the batch size', async () => {
        await append()
        await append()
        await append()

        expect(await store.claim(2, now)).toHaveLength(2)
    })

    it('never claims completed events again', async () => {
        await append()
        const [entry] = await store.claim(10, now)
        await store.complete(entry!.event.id, now)

        expect(await store.claim(10, new Date('2027-01-01T00:00:00Z'))).toEqual([])
    })

    it('schedules retries and gives up when told to', async () => {
        await append()
        const [entry] = await store.claim(10, now)
        const retryAt = new Date(now.getTime() + 60 * 1000)

        await store.fail(entry!.event.id, 'boom', retryAt)
        const [retried] = await store.claim(10, retryAt)
        expect(retried).toMatchObject({ attempts: 1 })

        await store.fail(retried!.event.id, 'boom again', null)
        expect(await store.claim(10, new Date('2027-01-01T00:00:00Z'))).toEqual([])
        const [row] = await sql`select attempts, last_error, dead_at from outbox`
        expect(row).toMatchObject({ attempts: 2, last_error: 'boom again' })
        expect(row!.dead_at).not.toBeNull()
    })
})
