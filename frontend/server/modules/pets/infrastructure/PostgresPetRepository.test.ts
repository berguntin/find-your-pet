import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../../shared/infrastructure/database'
import { Pet, type ReportPetData } from '../domain/Pet'
import { PostgresPetRepository } from './PostgresPetRepository'

/**
 * Integration tests against a real, migrated Postgres. They run only when TEST_DATABASE_URL is set,
 * and empty the `pets` table, so never point it to a database with real data.
 */
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresPetRepository', () => {
    const sql = createDatabase(url!)
    const repository = new PostgresPetRepository(sql)
    let seconds = 0

    const report = (id: string, overrides: Partial<ReportPetData> = {}) =>
        Pet.report(
            {
                reportType: 'lost',
                species: 'dog',
                description: 'Perro negro',
                location: 'Catarroja',
                contact: '600000000',
                images: ['https://img/1.jpg', 'https://img/2.jpg'],
                eventDate: '2026-10-01',
                ...overrides
            },
            { id, now: new Date(Date.UTC(2026, 9, 19, 10, 0, seconds++)) }
        )

    beforeEach(async () => {
        await sql`delete from pets`
        await sql`delete from outbox`
    })

    afterAll(async () => {
        await sql.end()
    })

    it('saves and restores every field', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001', { name: 'Rex' })
        await repository.save(pet)

        expect((await repository.findById(pet.id))?.toSnapshot()).toEqual(pet.toSnapshot())
    })

    it('saves moderation data', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001')
        const scores = { isPetReport: 0.91, showsAnimal: 0.8, inappropriate: 0.02 }
        pet.applyAutomaticModeration('approved', scores, new Date('2026-10-19T10:00:05Z'))
        await repository.save(pet)

        expect((await repository.findById(pet.id))?.toSnapshot()).toMatchObject({
            moderationStatus: 'approved',
            moderationScores: scores,
            moderatedAt: new Date('2026-10-19T10:00:05Z')
        })
    })

    it('stores recorded events in the outbox with the pet', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001')
        pet.applyAutomaticModeration('approved', null, new Date('2026-10-19T10:00:05Z'))
        await repository.save(pet)

        const rows = await sql`select type, payload from outbox`
        expect(rows.map(r => ({ ...r }))).toEqual([{ type: 'pet.published', payload: { petId: pet.id } }])
    })

    it('stores neither the pet nor its events if the save fails', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001')
        pet.applyAutomaticModeration('approved', null, new Date('2026-10-19T10:00:05Z'))
        // Break the row on purpose: the database rejects an empty image list.
        ;(pet as unknown as { props: { images: string[] } }).props.images = []

        await expect(repository.save(pet)).rejects.toThrow()
        expect(await sql`select 1 from outbox`).toHaveLength(0)
        expect(await repository.findById(pet.id)).toBeNull()
    })

    it('lists every referenced image once', async () => {
        await repository.save(report('00000000-0000-4000-8000-000000000001'))
        await repository.save(report('00000000-0000-4000-8000-000000000002', { images: ['https://img/1.jpg'] }))

        expect((await repository.listAllImageUrls()).sort()).toEqual(['https://img/1.jpg', 'https://img/2.jpg'])
    })

    it('updates on save', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001')
        await repository.save(pet)
        pet.markAsReunited({ kind: 'admin' }, new Date('2026-10-20T00:00:00Z'))
        await repository.save(pet)

        expect((await repository.findById(pet.id))?.isReunited).toBe(true)
    })

    it('deletes', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001')
        await repository.save(pet)
        await repository.delete(pet.id)

        expect(await repository.findById(pet.id)).toBeNull()
    })

    it('filters, searches and paginates newest first', async () => {
        await repository.save(report('00000000-0000-4000-8000-000000000001', { description: 'Perro 100% negro' }))
        await repository.save(report('00000000-0000-4000-8000-000000000002', { reportType: 'found' }))
        await repository.save(report('00000000-0000-4000-8000-000000000003', { location: 'Paiporta' }))

        const first = await repository.search({ limit: 2 })
        const second = await repository.search({ limit: 2, cursor: first.nextCursor! })
        const found = await repository.search({ limit: 10, reportType: 'found' })
        const byText = await repository.search({ limit: 10, query: 'paipor' })
        const literalPercent = await repository.search({ limit: 10, query: '100%' })
        const approved = await repository.search({ limit: 10, moderationStatus: 'approved' })

        expect(first.items.map(p => p.id.at(-1))).toEqual(['3', '2'])
        expect(second.items.map(p => p.id.at(-1))).toEqual(['1'])
        expect(second.nextCursor).toBeNull()
        expect(found.items.map(p => p.id.at(-1))).toEqual(['2'])
        expect(byText.items.map(p => p.id.at(-1))).toEqual(['3'])
        expect(literalPercent.items.map(p => p.id.at(-1))).toEqual(['1'])
        expect(approved.items).toEqual([])
    })

    it('counts reports and reunions per day in the time zone, and pets by state', async () => {
        const lost = report('00000000-0000-4000-8000-000000000001')
        lost.applyAutomaticModeration('approved', null, new Date())
        // 01:30 on the 20th in Madrid, still the 19th in UTC.
        lost.markAsReunited({ kind: 'admin' }, new Date('2026-10-19T23:30:00Z'))
        const found = report('00000000-0000-4000-8000-000000000002', { reportType: 'found', species: 'cat' })
        await repository.save(lost)
        await repository.save(found)
        await repository.save(report('00000000-0000-4000-8000-000000000003'))

        const activity = await repository.countDailyActivity(new Date('2026-10-01T00:00:00Z'), 'Europe/Madrid')
        const states = await repository.countByState()

        expect(activity).toEqual(
            expect.arrayContaining([
                { day: '2026-10-19', kind: 'reported', reportType: 'lost', species: 'dog', count: 2 },
                { day: '2026-10-19', kind: 'reported', reportType: 'found', species: 'cat', count: 1 },
                { day: '2026-10-20', kind: 'reunited', reportType: 'lost', species: 'dog', count: 1 }
            ])
        )
        expect(activity).toHaveLength(3)
        expect(await repository.countDailyActivity(new Date('2026-10-20T00:00:00Z'), 'UTC')).toEqual([])
        expect(states).toEqual(
            expect.arrayContaining([
                { reportType: 'lost', resolution: 'reunited', moderationStatus: 'approved', count: 1 },
                { reportType: 'lost', resolution: 'open', moderationStatus: 'pending_review', count: 1 },
                { reportType: 'found', resolution: 'open', moderationStatus: 'pending_review', count: 1 }
            ])
        )
        expect(states).toHaveLength(3)
    })
})
