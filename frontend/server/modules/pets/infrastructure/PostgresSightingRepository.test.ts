import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../../shared/infrastructure/database'
import { StaleSightingError } from '../application/ports'
import { Pet } from '../domain/Pet'
import { Sighting } from '../domain/Sighting'
import { PostgresPetRepository } from './PostgresPetRepository'
import { PostgresSightingRepository } from './PostgresSightingRepository'

/**
 * Integration tests against a real, migrated Postgres. They run only when TEST_DATABASE_URL is set,
 * and empty the `pets`, `users` and `outbox` tables, so never point it to a database with real data.
 */
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresSightingRepository', () => {
    const sql = createDatabase(url!)
    const repository = new PostgresSightingRepository(sql)
    const pets = new PostgresPetRepository(sql)
    const now = new Date('2026-11-08T12:00:00Z')
    const PET_ID = '00000000-0000-4000-9000-000000000001'
    const AUTHOR = '00000000-0000-4000-a000-000000000001'
    const VALIDATORS = ['00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003']
    let counter = 0

    const sighting = (overrides: { seenAt?: Date; images?: string[] } = {}) => {
        const id = `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`
        const created = Sighting.report(
            {
                description: 'Lo vi en la plaza del pueblo',
                area: 'Paiporta',
                seenAt: overrides.seenAt ?? new Date('2026-11-08T09:00:00Z'),
                images: overrides.images
            },
            { id, petId: PET_ID, authorId: AUTHOR, now }
        )
        return created
    }

    beforeEach(async () => {
        await sql`delete from pets`
        await sql`delete from outbox`
        await sql`delete from users`
        for (const id of [AUTHOR, ...VALIDATORS]) {
            await sql`insert into users (id, display_name, created_at) values (${id}, 'Ana', ${now})`
        }
        await pets.save(
            Pet.report(
                {
                    reportType: 'lost',
                    species: 'dog',
                    description: 'Perro negro',
                    location: 'Paiporta',
                    contact: '600000000',
                    images: ['https://img/1.jpg'],
                    eventDate: '2026-11-01'
                },
                { id: PET_ID, now }
            )
        )
    })

    afterAll(async () => {
        await sql.end()
    })

    it('saves and restores every field, with validations and events', async () => {
        const created = sighting({ images: ['https://img/s.jpg'] })
        created.applyAutomaticModeration('approved', { isPetReport: 0.9, showsAnimal: 0.8, inappropriate: 0 }, now)
        await repository.add(created)

        const loaded = (await repository.findById(created.id))!
        expect(loaded.toSnapshot()).toEqual({ ...created.toSnapshot(), version: 0 })

        // The validator is the pet's owner here: verified on their own.
        loaded.validate(VALIDATORS[0]!, VALIDATORS[0]!, now)
        await repository.save(loaded)

        const verified = (await repository.findById(created.id))!
        expect(verified.toSnapshot()).toMatchObject({ verifiedBy: 'owner', version: 1 })
        expect(verified.toSnapshot().validations).toEqual([{ userId: VALIDATORS[0], weight: 3, createdAt: now }])
        const events = await sql<{ type: string }[]>`select type from outbox where type like 'sighting.%'`
        expect(events.map(event => event.type).sort()).toEqual(['sighting.published', 'sighting.verified'])
    })

    it('never brings back a sighting deleted after it was loaded', async () => {
        const created = sighting()
        created.applyAutomaticModeration('approved', null, now)
        await repository.add(created)
        const loaded = (await repository.findById(created.id))!
        await repository.delete(created.id)

        loaded.validate(VALIDATORS[0]!, null, now)
        await expect(repository.save(loaded)).rejects.toThrow(StaleSightingError)
        expect(await repository.findById(created.id)).toBeNull()
    })

    it('filters by viewer and caps the list', async () => {
        const mine = sighting()
        const published = sighting()
        published.applyAutomaticModeration('approved', null, now)
        await repository.add(mine)
        await repository.add(published)

        const ids = async (options: { includeAuthorId?: string | null; includeAll?: boolean; limit: number }) =>
            (await repository.listByPet(PET_ID, options)).map(s => s.id).sort()
        expect(await ids({ limit: 10 })).toEqual([published.id])
        expect(await ids({ includeAuthorId: AUTHOR, limit: 10 })).toEqual([mine.id, published.id].sort())
        expect(await ids({ includeAll: true, limit: 10 })).toEqual([mine.id, published.id].sort())
        expect(await repository.listByPet(PET_ID, { includeAll: true, limit: 1 })).toHaveLength(1)
    })

    it('refuses to overwrite a sighting saved by someone else since it was loaded', async () => {
        const created = sighting()
        created.applyAutomaticModeration('approved', null, now)
        await repository.add(created)
        const first = (await repository.findById(created.id))!
        const second = (await repository.findById(created.id))!

        first.validate(VALIDATORS[0]!, null, now)
        await repository.save(first)
        second.validate(VALIDATORS[1]!, null, now)

        await expect(repository.save(second)).rejects.toThrow(StaleSightingError)
        expect((await repository.findById(created.id))!.points).toBe(1)
    })

    it('lists by pet (latest seen first) and by status (newest first), and lists images', async () => {
        const older = sighting({ seenAt: new Date('2026-11-07T09:00:00Z'), images: ['https://img/a.jpg'] })
        const newer = sighting({ seenAt: new Date('2026-11-08T09:00:00Z') })
        newer.applyAutomaticModeration('approved', null, now)
        await repository.add(older)
        await repository.add(newer)

        expect((await repository.listByPet(PET_ID, { includeAll: true, limit: 10 })).map(s => s.id)).toEqual([
            newer.id,
            older.id
        ])
        expect((await repository.listByStatus('pending_review', 10)).map(s => s.id)).toEqual([older.id])
        expect(await repository.listByPet('00000000-0000-4000-9000-000000000999', { limit: 10 })).toEqual([])
        expect(await repository.listAllImageUrls()).toEqual(['https://img/a.jpg'])
    })

    it('deletes sightings, and loses them with their pet or keeps them anonymous without their author', async () => {
        const kept = sighting()
        const removed = sighting()
        await repository.add(kept)
        await repository.add(removed)

        await repository.delete(removed.id)
        expect(await repository.findById(removed.id)).toBeNull()

        await sql`delete from users where id = ${AUTHOR}`
        expect((await repository.findById(kept.id))!.toSnapshot().authorId).toBeNull()

        await pets.delete(PET_ID)
        expect(await repository.findById(kept.id)).toBeNull()
    })
})
