import { beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '../../../shared/domain/actor'
import { ForbiddenError } from '../../../shared/domain/errors'
import { DEFAULT_MODERATION_THRESHOLDS, type ModerationRecord } from '../domain/moderation'
import { Pet, type ReportPetData } from '../domain/Pet'
import { InMemoryModerationLog } from '../infrastructure/InMemoryModerationLog'
import { InMemoryPetRepository } from '../infrastructure/InMemoryPetRepository'
import { calendarDay, daysEndingOn, GetModerationOverview, GetPetStats, STATS_TIME_ZONE } from './stats'

const admin: Actor = { kind: 'admin' }
const anonymous: Actor = { kind: 'anonymous' }
// 23:30 in Madrid (UTC+2 in October): already the 21st there, still the 21st in UTC.
const now = new Date('2026-10-21T21:30:00Z')
const clock = { now: () => now }

describe('calendar days', () => {
    it('uses the day in the time zone, not in UTC', () => {
        expect(calendarDay(new Date('2026-10-20T22:30:00Z'), STATS_TIME_ZONE)).toBe('2026-10-21')
        expect(calendarDay(new Date('2026-10-20T22:30:00Z'), 'UTC')).toBe('2026-10-20')
    })

    it('lists consecutive days across month ends and daylight saving changes', () => {
        expect(daysEndingOn('2026-11-01', 4)).toEqual(['2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    })
})

describe('GetPetStats', () => {
    let repository: InMemoryPetRepository
    let counter = 0

    const store = async (createdAt: string, data: Partial<ReportPetData> = {}, setup?: (pet: Pet) => void) => {
        const pet = Pet.report(
            {
                reportType: 'lost',
                species: 'dog',
                description: 'Perro',
                location: 'Paiporta',
                contact: '600000000',
                images: ['https://img/1.jpg'],
                eventDate: '2026-01-01',
                ...data
            },
            { id: `pet-${++counter}`, now: new Date(createdAt) }
        )
        pet.applyAutomaticModeration('approved', null, new Date(createdAt))
        setup?.(pet)
        await repository.save(pet)
        return pet
    }

    beforeEach(() => {
        repository = new InMemoryPetRepository()
    })

    it('counts new lost and found pets and reunions per day, filling empty days', async () => {
        await store('2026-10-21T08:00:00Z')
        await store('2026-10-21T09:00:00Z', { species: 'cat' })
        // 01:00 on the 21st in Madrid.
        await store('2026-10-20T23:00:00Z', { reportType: 'found' })
        await store('2026-10-19T10:00:00Z', {}, pet => pet.markAsReunited(admin, new Date('2026-10-21T10:00:00Z')))

        const stats = await new GetPetStats(repository, clock).execute(7, admin)

        expect(stats.daily).toHaveLength(7)
        expect(stats.daily[0]!.day).toBe('2026-10-15')
        expect(stats.daily.at(-1)).toEqual({ day: '2026-10-21', lost: 2, found: 1, reunited: 1 })
        expect(stats.daily.at(-3)).toEqual({ day: '2026-10-19', lost: 1, found: 0, reunited: 0 })
        expect(stats.period).toEqual({ lost: 3, found: 1, reunited: 1, lostBySpecies: { dog: 2, cat: 1, other: 0 } })
    })

    it('compares with the previous period and ignores older activity', async () => {
        await store('2026-10-10T10:00:00Z')
        await store('2026-10-09T10:00:00Z', { reportType: 'found' })
        await store('2026-09-01T10:00:00Z')

        const stats = await new GetPetStats(repository, clock).execute(7, admin)

        expect(stats.period.lost).toBe(0)
        expect(stats.previousPeriod).toMatchObject({ lost: 1, found: 1 })
    })

    it('summarises every stored pet', async () => {
        await store('2026-09-01T10:00:00Z')
        await store('2026-09-01T10:00:00Z', { reportType: 'found' })
        await store('2026-09-01T10:00:00Z', {}, pet => pet.markAsReunited(admin, now))
        await store('2026-09-01T10:00:00Z', {}, pet => pet.unpublish(admin, now))

        const { totals } = await new GetPetStats(repository, clock).execute(30, admin)

        expect(totals).toEqual({ all: 4, published: 3, pendingReview: 1, open: { lost: 1, found: 1 }, reunited: 1 })
    })

    it('is admin only', async () => {
        await expect(new GetPetStats(repository, clock).execute(7, anonymous)).rejects.toThrow(ForbiddenError)
    })
})

describe('GetModerationOverview', () => {
    let log: InMemoryModerationLog
    let repository: InMemoryPetRepository
    let counter = 0

    const decide = (decidedAt: string, record: Partial<ModerationRecord> = {}) =>
        log.record({
            id: `decision-${++counter}`,
            petId: null,
            source: 'automatic',
            decision: 'approved',
            scores: { isPetReport: 0.9, showsAnimal: 0.9, inappropriate: 0 },
            model: 'gpt-6-luna',
            error: null,
            latencyMs: 1000,
            submission: null,
            decidedAt: new Date(decidedAt),
            ...record
        })

    const overview = (model: string | null = 'gpt-6-luna') =>
        new GetModerationOverview(
            log,
            repository,
            { model, review: async () => ({ isPetReport: 1, showsAnimal: 1, inappropriate: 0 }) },
            DEFAULT_MODERATION_THRESHOLDS,
            clock
        )

    beforeEach(() => {
        log = new InMemoryModerationLog()
        repository = new InMemoryPetRepository()
    })

    it('summarises automatic and admin decisions of the period', async () => {
        await decide('2026-10-21T10:00:00Z', { latencyMs: 800 })
        await decide('2026-10-21T11:00:00Z', { decision: 'rejected', latencyMs: 1200 })
        await decide('2026-10-20T10:00:00Z', { decision: 'pending_review', scores: null, error: 'timeout' })
        await decide('2026-10-20T10:00:00Z', { decision: 'pending_review', latencyMs: null })
        await decide('2026-10-21T12:00:00Z', { source: 'admin', decision: 'approved', latencyMs: null })
        await decide('2026-10-21T12:00:00Z', { source: 'admin', decision: 'rejected', latencyMs: null })
        await decide('2026-09-01T10:00:00Z', { decision: 'rejected' })

        const result = await overview().execute(7, admin)

        expect(result.automatic).toEqual({
            total: 4,
            approved: 1,
            pendingReview: 2,
            rejected: 1,
            failed: 1,
            averageLatencyMs: 1000
        })
        expect(result.admin).toEqual({ approved: 1, pendingReview: 0, rejected: 1 })
        expect(result.daily.at(-1)).toEqual({
            day: '2026-10-21',
            approved: 1,
            pendingReview: 0,
            rejected: 1,
            failed: 0
        })
        expect(result.daily.at(-2)).toEqual({
            day: '2026-10-20',
            approved: 0,
            pendingReview: 2,
            rejected: 0,
            failed: 1
        })
        expect(result.recent.map(r => r.id)).toEqual([
            'decision-5',
            'decision-6',
            'decision-2',
            'decision-1',
            'decision-3',
            'decision-4',
            'decision-7'
        ])
    })

    it('describes the moderator and the review queue', async () => {
        const pending = Pet.report(
            {
                reportType: 'lost',
                species: 'dog',
                description: 'Perro',
                location: 'Paiporta',
                contact: '600000000',
                images: ['https://img/1.jpg'],
                eventDate: '2026-01-01'
            },
            { id: 'pet-1', now }
        )
        await repository.save(pending)

        const result = await overview(null).execute(30, admin)

        expect(result.moderator).toEqual({ enabled: false, model: null, thresholds: DEFAULT_MODERATION_THRESHOLDS })
        expect(result.pendingReview).toBe(1)
        expect(result.automatic.averageLatencyMs).toBeNull()
        expect(result.daily).toHaveLength(30)
    })

    it('is admin only', async () => {
        await expect(overview().execute(7, anonymous)).rejects.toThrow(ForbiddenError)
    })
})
