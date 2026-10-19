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
    })

    afterAll(async () => {
        await sql.end()
    })

    it('saves and restores every field', async () => {
        const pet = report('00000000-0000-4000-8000-000000000001', { name: 'Rex' })
        await repository.save(pet)

        expect((await repository.findById(pet.id))?.toSnapshot()).toEqual(pet.toSnapshot())
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

        expect(first.items.map(p => p.id.at(-1))).toEqual(['3', '2'])
        expect(second.items.map(p => p.id.at(-1))).toEqual(['1'])
        expect(second.nextCursor).toBeNull()
        expect(found.items.map(p => p.id.at(-1))).toEqual(['2'])
        expect(byText.items.map(p => p.id.at(-1))).toEqual(['3'])
        expect(literalPercent.items.map(p => p.id.at(-1))).toEqual(['1'])
    })
})
