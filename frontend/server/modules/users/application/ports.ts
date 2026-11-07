import type { AuthProvider, ExternalIdentity, User } from '../domain/User'

export interface UserRepository {
    findById(id: string): Promise<User | null>
    findByIdentity(provider: AuthProvider, subject: string): Promise<User | null>
    /**
     * Stores a new user together with the identity it signs in with, atomically. If the identity already
     * belongs to someone (a concurrent first sign-in), nothing is stored and that existing user is returned.
     */
    create(user: User, identity: Pick<ExternalIdentity, 'provider' | 'subject'>): Promise<User>
    exists(id: string): Promise<boolean>
    /** First names by user id; missing ids (deleted accounts) are left out. */
    displayNames(ids: string[]): Promise<Map<string, string>>
    update(user: User): Promise<void>
    /** Removes the user and its identities; their reports stay, without an owner. */
    delete(id: string): Promise<void>
}
