import type { Clock } from '../../../shared/application/ports'
import type { Actor } from '../../../shared/domain/actor'
import { ForbiddenError } from '../../../shared/domain/errors'
import type { ModerationRecord, ModerationThresholds } from '../domain/moderation'
import { REPORT_TYPES, SPECIES, type ReportType, type Species } from '../domain/values'
import type { ContentModerator, ModerationLog, PetRepository } from './ports'

/** Statistics group days as people in Spain live them, not in UTC. */
export const STATS_TIME_ZONE = 'Europe/Madrid'

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const RECENT_DECISIONS = 20

/** The calendar day (YYYY-MM-DD) of an instant in a time zone. */
export function calendarDay(date: Date, timeZone: string): string {
    // en-CA formats dates as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
        date
    )
}

/** The `count` calendar days ending on `lastDay`, oldest first. */
export function daysEndingOn(lastDay: string, count: number): string[] {
    const [year, month, day] = lastDay.split('-').map(Number) as [number, number, number]
    return Array.from({ length: count }, (_, i) =>
        new Date(Date.UTC(year, month - 1, day - (count - 1 - i))).toISOString().slice(0, 10)
    )
}

/**
 * The last `days` calendar days and the `days` before them, plus an instant early enough to query both.
 * One extra day of margin covers any time zone offset; rows outside the days are ignored.
 */
function periods(now: Date, days: number) {
    const all = daysEndingOn(calendarDay(now, STATS_TIME_ZONE), days * 2)
    return {
        current: all.slice(days),
        previous: all.slice(0, days),
        since: new Date(now.getTime() - (days * 2 + 1) * ONE_DAY_MS)
    }
}

export interface PetDailyStats {
    day: string
    lost: number
    found: number
    reunited: number
}

export interface PetPeriodStats {
    lost: number
    found: number
    reunited: number
    lostBySpecies: Record<Species, number>
}

export interface PetStats {
    days: number
    timeZone: string
    daily: PetDailyStats[]
    period: PetPeriodStats
    previousPeriod: PetPeriodStats
    totals: {
        all: number
        published: number
        pendingReview: number
        /** Published cases still open, by report type. */
        open: Record<ReportType, number>
        reunited: number
    }
}

/** New lost and found pets per day, reunions, and how the current period compares with the previous one. */
export class GetPetStats {
    constructor(private readonly pets: PetRepository, private readonly clock: Clock) {}

    async execute(days: number, actor: Actor): Promise<PetStats> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        const { current, previous, since } = periods(this.clock.now(), days)
        const [activity, states] = await Promise.all([
            this.pets.countDailyActivity(since, STATS_TIME_ZONE),
            this.pets.countByState()
        ])

        const daily = new Map(current.map(day => [day, { day, lost: 0, found: 0, reunited: 0 }]))
        const emptyPeriod = (): PetPeriodStats => ({
            lost: 0,
            found: 0,
            reunited: 0,
            lostBySpecies: Object.fromEntries(SPECIES.map(species => [species, 0])) as Record<Species, number>
        })
        const period = emptyPeriod()
        const previousPeriod = emptyPeriod()
        const previousDays = new Set(previous)

        for (const row of activity) {
            const target = daily.has(row.day) ? period : previousDays.has(row.day) ? previousPeriod : null
            if (!target) continue
            const key = row.kind === 'reunited' ? 'reunited' : row.reportType
            target[key] += row.count
            if (row.kind === 'reported' && row.reportType === 'lost') target.lostBySpecies[row.species] += row.count
            const day = daily.get(row.day)
            if (day) day[key] += row.count
        }

        const sum = (filter: (row: (typeof states)[number]) => boolean) =>
            states.filter(filter).reduce((total, row) => total + row.count, 0)
        const isPublished = (row: (typeof states)[number]) => row.moderationStatus === 'approved'

        return {
            days,
            timeZone: STATS_TIME_ZONE,
            daily: [...daily.values()],
            period,
            previousPeriod,
            totals: {
                all: sum(() => true),
                published: sum(isPublished),
                pendingReview: sum(row => row.moderationStatus === 'pending_review'),
                open: Object.fromEntries(
                    REPORT_TYPES.map(type => [
                        type,
                        sum(row => isPublished(row) && row.resolution === 'open' && row.reportType === type)
                    ])
                ) as Record<ReportType, number>,
                reunited: sum(row => row.resolution === 'reunited')
            }
        }
    }
}

export interface ModerationDailyStats {
    day: string
    approved: number
    pendingReview: number
    rejected: number
    /** Reports sent to review because the moderator failed (included in pendingReview). */
    failed: number
}

export interface ModerationOverview {
    days: number
    timeZone: string
    moderator: {
        /** False when no model is configured: see the container for what happens then. */
        enabled: boolean
        model: string | null
        thresholds: ModerationThresholds
    }
    automatic: {
        total: number
        approved: number
        pendingReview: number
        rejected: number
        failed: number
        averageLatencyMs: number | null
    }
    /** What admins did afterwards: publish, hide again, or reject. */
    admin: { approved: number; pendingReview: number; rejected: number }
    /** Reports waiting for an admin right now. */
    pendingReview: number
    daily: ModerationDailyStats[]
    recent: ModerationRecord[]
}

/** How the automatic moderator is configured and how it has decided lately, next to the admins' decisions. */
export class GetModerationOverview {
    constructor(
        private readonly log: ModerationLog,
        private readonly pets: PetRepository,
        private readonly moderator: ContentModerator,
        private readonly thresholds: ModerationThresholds,
        private readonly clock: Clock
    ) {}

    async execute(days: number, actor: Actor): Promise<ModerationOverview> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        const { current, since } = periods(this.clock.now(), days)
        const [counts, recent, states] = await Promise.all([
            this.log.countByDay(since, STATS_TIME_ZONE),
            this.log.recent(RECENT_DECISIONS),
            this.pets.countByState()
        ])

        const daily = new Map(current.map(day => [day, { day, approved: 0, pendingReview: 0, rejected: 0, failed: 0 }]))
        const automatic = { total: 0, approved: 0, pendingReview: 0, rejected: 0, failed: 0 }
        const admin = { approved: 0, pendingReview: 0, rejected: 0 }
        let latencyMsTotal = 0
        let latencyCount = 0

        for (const row of counts) {
            const day = daily.get(row.day)
            if (!day) continue
            const key = row.decision === 'pending_review' ? 'pendingReview' : row.decision
            if (row.source === 'admin') {
                admin[key] += row.count
                continue
            }
            automatic.total += row.count
            automatic[key] += row.count
            day[key] += row.count
            if (row.failed) {
                automatic.failed += row.count
                day.failed += row.count
            }
            latencyMsTotal += row.latencyMsTotal
            latencyCount += row.latencyCount
        }

        return {
            days,
            timeZone: STATS_TIME_ZONE,
            moderator: {
                enabled: this.moderator.model !== null,
                model: this.moderator.model,
                thresholds: this.thresholds
            },
            automatic: {
                ...automatic,
                averageLatencyMs: latencyCount > 0 ? Math.round(latencyMsTotal / latencyCount) : null
            },
            admin,
            pendingReview: states
                .filter(row => row.moderationStatus === 'pending_review')
                .reduce((total, row) => total + row.count, 0),
            daily: [...daily.values()],
            recent
        }
    }
}
