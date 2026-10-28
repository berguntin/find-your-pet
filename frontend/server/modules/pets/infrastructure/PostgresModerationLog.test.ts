import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../../shared/infrastructure/database'
import type { ModerationRecord } from '../domain/moderation'
import { PostgresModerationLog } from './PostgresModerationLog'

/**
 * Integration tests against a real, migrated Postgres. They run only when TEST_DATABASE_URL is set,
 * and empty the `moderation_decisions` table, so never point it to a database with real data.
 */
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresModerationLog', () => {
    const sql = createDatabase(url!)
    const log = new PostgresModerationLog(sql)
    let counter = 0

    const decision = (overrides: Partial<ModerationRecord> = {}): ModerationRecord => ({
        id: `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`,
        petId: '00000000-0000-4000-9000-000000000001',
        source: 'automatic',
        decision: 'approved',
        scores: { isPetReport: 0.9, showsAnimal: 0.8, inappropriate: 0.01 },
        model: 'gpt-6-luna',
        error: null,
        latencyMs: 900,
        submission: { reportType: 'lost', species: 'dog', name: null, description: 'Perro', location: 'Paiporta' },
        decidedAt: new Date('2026-10-19T10:00:00Z'),
        ...overrides
    })

    beforeEach(async () => {
        await sql`delete from moderation_decisions`
    })

    afterAll(async () => {
        await sql.end()
    })

    it('stores and returns decisions, newest first', async () => {
        const older = decision()
        const newer = decision({
            petId: null,
            source: 'admin',
            decision: 'rejected',
            scores: null,
            model: null,
            latencyMs: null,
            submission: null,
            decidedAt: new Date('2026-10-20T10:00:00Z')
        })
        await log.record(older)
        await log.record(newer)

        expect(await log.recent(10)).toEqual([newer, older])
        expect(await log.recent(1)).toEqual([newer])
    })

    it('counts decisions per day in the time zone, with failures and latencies', async () => {
        await log.record(decision({ latencyMs: 1000 }))
        await log.record(decision({ latencyMs: 2000 }))
        await log.record(decision({ decision: 'pending_review', error: 'timeout', scores: null, latencyMs: null }))
        // 00:30 on the 20th in Madrid.
        await log.record(decision({ decidedAt: new Date('2026-10-19T22:30:00Z') }))
        await log.record(decision({ decidedAt: new Date('2026-09-01T10:00:00Z') }))

        const counts = await log.countByDay(new Date('2026-10-01T00:00:00Z'), 'Europe/Madrid')

        expect(counts).toEqual(
            expect.arrayContaining([
                {
                    day: '2026-10-19',
                    source: 'automatic',
                    decision: 'approved',
                    failed: false,
                    count: 2,
                    latencyMsTotal: 3000,
                    latencyCount: 2
                },
                {
                    day: '2026-10-19',
                    source: 'automatic',
                    decision: 'pending_review',
                    failed: true,
                    count: 1,
                    latencyMsTotal: 0,
                    latencyCount: 0
                },
                {
                    day: '2026-10-20',
                    source: 'automatic',
                    decision: 'approved',
                    failed: false,
                    count: 1,
                    latencyMsTotal: 900,
                    latencyCount: 1
                }
            ])
        )
        expect(counts).toHaveLength(3)
    })
})
