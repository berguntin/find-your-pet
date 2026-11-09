import type { Clock, IdGenerator } from '../../../shared/application/ports'
import { NotFoundError } from '../../../shared/domain/errors'
import { User, type ExternalIdentity } from '../domain/User'
import type { UserRepository } from './ports'

/** Runs on every sign-in: returns the user behind the provider account, creating it the first time. */
export class FindOrCreateUserFromIdentity {
    constructor(
        private readonly users: UserRepository,
        private readonly clock: Clock,
        private readonly ids: IdGenerator
    ) {}

    async execute(identity: ExternalIdentity): Promise<User> {
        const existing = await this.users.findByIdentity(identity.provider, identity.subject)
        if (existing) {
            if (existing.refreshFrom(identity)) await this.users.update(existing)
            return existing
        }

        const user = User.register(identity, { id: this.ids.next(), now: this.clock.now() })
        // Two simultaneous first sign-ins (a double tap): the repository returns whichever user won.
        return this.users.create(user, identity)
    }
}

export class GetUser {
    constructor(private readonly users: UserRepository) {}

    async execute(id: string): Promise<User> {
        const user = await this.users.findById(id)
        if (!user) throw new NotFoundError('User not found')
        return user
    }
}

/**
 * Right to erasure: the account goes; reports it created stay public without an owner.
 * Idempotent, so a session left on another device can still sign out cleanly.
 */
export class DeleteAccount {
    constructor(private readonly users: UserRepository) {}

    async execute(id: string): Promise<void> {
        await this.users.delete(id)
    }
}
