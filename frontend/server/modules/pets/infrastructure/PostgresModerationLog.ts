import type { Database } from '../../../shared/infrastructure/database'
import type { ModerationDayCount, ModerationLog } from '../application/ports'
import type {
    ModerationDecision,
    ModerationRecord,
    ModerationScores,
    ModerationSource,
    ModerationSubmissionSummary
} from '../domain/moderation'

interface ModerationRow {
    id: string
    pet_id: string | null
    source: ModerationSource
    decision: ModerationDecision
    scores: ModerationScores | null
    model: string | null
    error: string | null
    latency_ms: number | null
    submission: ModerationSubmissionSummary | null
    decided_at: Date
}

export class PostgresModerationLog implements ModerationLog {
    constructor(private readonly sql: Database) {}

    async record(record: ModerationRecord): Promise<void> {
        const sql = this.sql
        await sql`
            insert into moderation_decisions
                (id, pet_id, source, decision, scores, model, error, latency_ms, submission, decided_at)
            values (
                ${record.id}, ${record.petId}, ${record.source}, ${record.decision},
                ${record.scores && sql.json(record.scores as never)}, ${record.model}, ${record.error},
                ${record.latencyMs}, ${record.submission && sql.json(record.submission as never)}, ${record.decidedAt}
            )
        `
    }

    async countByDay(since: Date, timeZone: string): Promise<ModerationDayCount[]> {
        const rows = await this.sql<
            {
                day: string
                source: ModerationSource
                decision: ModerationDecision
                failed: boolean
                count: number
                latency_ms_total: number
                latency_count: number
            }[]
        >`
            select
                to_char(decided_at at time zone ${timeZone}, 'YYYY-MM-DD') as day,
                source,
                decision,
                error is not null as failed,
                count(*)::int as count,
                coalesce(sum(latency_ms), 0)::int as latency_ms_total,
                count(latency_ms)::int as latency_count
            from moderation_decisions
            where decided_at >= ${since}
            group by 1, 2, 3, 4
        `
        return rows.map(row => ({
            day: row.day,
            source: row.source,
            decision: row.decision,
            failed: row.failed,
            count: row.count,
            latencyMsTotal: row.latency_ms_total,
            latencyCount: row.latency_count
        }))
    }

    async recent(limit: number): Promise<ModerationRecord[]> {
        const rows = await this.sql<ModerationRow[]>`
            select * from moderation_decisions order by decided_at desc, id desc limit ${limit}
        `
        return rows.map(row => ({
            id: row.id,
            petId: row.pet_id,
            source: row.source,
            decision: row.decision,
            scores: row.scores,
            model: row.model,
            error: row.error,
            latencyMs: row.latency_ms,
            submission: row.submission,
            decidedAt: row.decided_at
        }))
    }
}
