import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotFoundError } from '../../../shared/domain/errors'
import type { ExternalIdentity } from '../domain/User'
import { InMemoryUserRepository } from '../infrastructure/InMemoryUserRepository'
import { createUsersModule, type UsersModule } from '..'

const identity = (overrides: Partial<ExternalIdentity> = {}): ExternalIdentity => ({
    provider: 'google',
    subject: 'sub-1',
    email: 'ana@example.com',
    name: 'Ana',
    ...overrides
})

describe('users use cases', () => {
    let repository: InMemoryUserRepository
    let users: UsersModule

    beforeEach(() => {
        let counter = 0
        repository = new InMemoryUserRepository()
        users = createUsersModule({
            users: repository,
            clock: { now: () => new Date('2026-11-07T10:00:00Z') },
            ids: { next: () => `user-${++counter}` }
        })
    })

    it('creates a user on the first sign-in and finds it afterwards', async () => {
        const first = await users.signIn.execute(identity())
        const again = await users.signIn.execute(identity())

        expect(first.id).toBe('user-1')
        expect(again.id).toBe('user-1')
        expect((await users.get.execute('user-1')).displayName).toBe('Ana')
    })

    it('keeps the same user when the provider email or name changes', async () => {
        await users.signIn.execute(identity())
        const renamed = await users.signIn.execute(identity({ email: 'ana.new@example.com', name: 'Anabel' }))

        expect(renamed.id).toBe('user-1')
        expect((await repository.findById('user-1'))?.displayName).toBe('Anabel')
    })

    it('returns the user that won when two first sign-ins race', async () => {
        const winner = await users.signIn.execute(identity())
        vi.spyOn(repository, 'findByIdentity').mockResolvedValueOnce(null)

        const loser = await users.signIn.execute(identity())

        expect(loser.id).toBe(winner.id)
        expect(await repository.exists('user-2')).toBe(false)
    })

    it('creates different users for different provider accounts', async () => {
        await users.signIn.execute(identity())
        const other = await users.signIn.execute(identity({ subject: 'sub-2' }))

        expect(other.id).toBe('user-2')
    })

    it('deletes an account and its identity', async () => {
        await users.signIn.execute(identity())
        await users.deleteAccount.execute('user-1')

        await expect(users.get.execute('user-1')).rejects.toThrow(NotFoundError)
        expect(await repository.findByIdentity('google', 'sub-1')).toBeNull()
        // Idempotent: a session left on another device can still delete (and sign out).
        await expect(users.deleteAccount.execute('user-1')).resolves.toBeUndefined()
    })
})
