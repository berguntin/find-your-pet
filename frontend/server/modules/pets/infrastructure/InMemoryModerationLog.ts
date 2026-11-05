import type { ModerationDayCount, ModerationLog } from '../application/ports'
import { calendarDay } from '../application/stats'
import type { ModerationRecord } from '../domain/moderation'

/** Test double that keeps moderation decisions in memory. */
export class InMemoryModerationLog implements ModerationLog {
    readonly records: ModerationRecord[] = []

    async record(record: ModerationRecord): Promise<void> {
        this.records.push(structuredClone(record))
    }

    async countByDay(since: Date, timeZone: string): Promise<ModerationDayCount[]> {
        const counts = new Map<string, ModerationDayCount>()
        for (const record of this.records.filter(r => r.decidedAt >= since)) {
            const day = calendarDay(record.decidedAt, timeZone)
            const failed = record.error !== null
            const key = [day, record.source, record.decision, failed].join('|')
            const count = counts.get(key) ?? {
                day,
                source: record.source,
                decision: record.decision,
                failed,
                count: 0,
                latencyMsTotal: 0,
                latencyCount: 0
            }
            count.count++
            if (record.latencyMs !== null) {
                count.latencyMsTotal += record.latencyMs
                count.latencyCount++
            }
            counts.set(key, count)
        }
        return [...counts.values()]
    }

    async recent(limit: number): Promise<ModerationRecord[]> {
        return [...this.records]
            .sort((a, b) => b.decidedAt.getTime() - a.decidedAt.getTime())
            .slice(0, limit)
            .map(record => structuredClone(record))
    }
}
