import { describe, expect, it } from 'vitest'
import { ValidationError } from '../../../shared/domain/errors'
import { User, type ExternalIdentity } from './User'

const now = new Date('2026-11-07T10:00:00Z')
const identity = (overrides: Partial<ExternalIdentity> = {}): ExternalIdentity => ({
    provider: 'google',
    subject: 'google-sub-1',
    email: ' Ana.Garcia@Example.com ',
    name: 'Ana García López',
    ...overrides
})

describe('User', () => {
    it('registers with the first name only, without storing the email', () => {
        expect(User.register(identity(), { id: 'user-1', now }).toSnapshot()).toEqual({
            id: 'user-1',
            displayName: 'Ana',
            createdAt: now
        })
    })

    it('falls back to the email local part when the account has no name', () => {
        expect(User.publicName({ name: '  ', email: 'pepe@example.com' })).toBe('pepe')
    })

    it('rejects accounts without any usable name', () => {
        expect(() => User.publicName({ name: '', email: '@example.com' })).toThrow(ValidationError)
    })

    it('caps very long names', () => {
        expect(User.publicName({ name: 'a'.repeat(200), email: 'x@example.com' })).toHaveLength(80)
    })

    it('refreshes the name from the provider and says whether it changed', () => {
        const user = User.register(identity(), { id: 'user-1', now })

        expect(user.refreshFrom(identity({ email: 'other@example.com' }))).toBe(false)
        expect(user.refreshFrom(identity({ name: 'Anabel' }))).toBe(true)
        expect(user.displayName).toBe('Anabel')
    })
})
