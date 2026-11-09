import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../../shared/infrastructure/database'
import { Pet } from '../../pets/domain/Pet'
import { PostgresPetRepository } from '../../pets/infrastructure/PostgresPetRepository'
import { User } from '../domain/User'
import { PostgresUserRepository } from './PostgresUserRepository'

/**
 * Integration tests against a real, migrated Postgres. They run only when TEST_DATABASE_URL is set,
 * and empty the `users` and `pets` tables, so never point it to a database with real data.
 */
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresUserRepository', () => {
    const sql = createDatabase(url!)
    const repository = new PostgresUserRepository(sql)
    const now = new Date('2026-11-07T10:00:00Z')
    const USER_ID = '00000000-0000-4000-8000-000000000001'
    const identity = { provider: 'google' as const, subject: 'sub-1', email: 'Ana@Example.com', name: 'Ana López' }

    beforeEach(async () => {
        await sql`delete from pets`
        await sql`delete from outbox`
        await sql`delete from users`
    })

    afterAll(async () => {
        await sql.end()
    })

    it('creates a user with its identity and finds it by either', async () => {
        const user = User.register(identity, { id: USER_ID, now })
        await repository.create(user, identity)

        expect((await repository.findById(USER_ID))?.toSnapshot()).toEqual(user.toSnapshot())
        expect((await repository.findByIdentity('google', 'sub-1'))?.id).toBe(USER_ID)
        expect(await repository.findByIdentity('google', 'other')).toBeNull()
        expect(await repository.findById('00000000-0000-4000-8000-000000000999')).toBeNull()
        expect(await repository.exists(USER_ID)).toBe(true)
        expect(await repository.exists('00000000-0000-4000-8000-000000000999')).toBe(false)
    })

    it('returns the existing user when the identity is already taken, without storing a duplicate', async () => {
        const first = User.register(identity, { id: USER_ID, now })
        await repository.create(first, identity)
        const duplicate = User.register(identity, { id: '00000000-0000-4000-8000-000000000002', now })

        expect((await repository.create(duplicate, identity)).id).toBe(USER_ID)
        expect(await repository.exists(duplicate.id)).toBe(false)
    })

    it('returns first names by id, leaving out unknown ids', async () => {
        await repository.create(User.register(identity, { id: USER_ID, now }), identity)

        expect(await repository.displayNames([USER_ID, '00000000-0000-4000-8000-000000000999'])).toEqual(
            new Map([[USER_ID, 'Ana']])
        )
        expect(await repository.displayNames([])).toEqual(new Map())
    })

    it('updates the name', async () => {
        const user = User.register(identity, { id: USER_ID, now })
        await repository.create(user, identity)
        user.refreshFrom({ ...identity, name: 'Anabel' })
        await repository.update(user)

        expect((await repository.findById(USER_ID))?.displayName).toBe('Anabel')
    })

    it('deletes the user and its identities, keeping its pets without an owner', async () => {
        await repository.create(User.register(identity, { id: USER_ID, now }), identity)
        const pets = new PostgresPetRepository(sql)
        const pet = Pet.report(
            {
                reportType: 'lost',
                species: 'dog',
                description: 'Perro negro',
                location: 'Catarroja',
                contact: '600000000',
                images: ['https://img/1.jpg'],
                eventDate: '2026-10-01'
            },
            { id: '00000000-0000-4000-9000-000000000001', now, ownerId: USER_ID }
        )
        await pets.save(pet)
        expect(await pets.findIdsByOwner(USER_ID)).toEqual([pet.id])

        await repository.delete(USER_ID)

        expect(await repository.findById(USER_ID)).toBeNull()
        expect(await sql`select 1 from auth_identities where user_id = ${USER_ID}`).toHaveLength(0)
        expect((await pets.findById(pet.id))?.toSnapshot().ownerId).toBeNull()
        expect(await pets.findIdsByOwner(USER_ID)).toEqual([])
    })
})
