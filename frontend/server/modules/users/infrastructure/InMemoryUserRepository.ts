import type { UserRepository } from '../application/ports'
import { User, type AuthProvider } from '../domain/User'

/** Test double that keeps users and their identities in memory. */
export class InMemoryUserRepository implements UserRepository {
    private readonly users = new Map<string, User>()
    private readonly identities = new Map<string, string>()

    async findById(id: string): Promise<User | null> {
        const user = this.users.get(id)
        return user ? User.restore(user.toSnapshot()) : null
    }

    async findByIdentity(provider: AuthProvider, subject: string): Promise<User | null> {
        const userId = this.identities.get(`${provider}:${subject}`)
        return userId ? this.findById(userId) : null
    }

    async create(user: User, identity: { provider: AuthProvider; subject: string }): Promise<User> {
        const existing = await this.findByIdentity(identity.provider, identity.subject)
        if (existing) return existing
        this.users.set(user.id, User.restore(user.toSnapshot()))
        this.identities.set(`${identity.provider}:${identity.subject}`, user.id)
        return user
    }

    async displayNames(ids: string[]): Promise<Map<string, string>> {
        return new Map(ids.flatMap(id => (this.users.has(id) ? [[id, this.users.get(id)!.displayName]] : [])))
    }

    async exists(id: string): Promise<boolean> {
        return this.users.has(id)
    }

    async update(user: User): Promise<void> {
        this.users.set(user.id, User.restore(user.toSnapshot()))
    }

    async delete(id: string): Promise<void> {
        this.users.delete(id)
        for (const [key, userId] of this.identities) if (userId === id) this.identities.delete(key)
    }
}
