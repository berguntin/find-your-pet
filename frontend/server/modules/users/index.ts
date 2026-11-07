import type { Clock, IdGenerator } from '../../shared/application/ports'
import type { UserRepository } from './application/ports'
import { DeleteAccount, FindOrCreateUserFromIdentity, GetUser } from './application/useCases'

export interface UsersModuleDependencies {
    users: UserRepository
    clock: Clock
    ids: IdGenerator
}

/** Public entry point of the users module. */
export function createUsersModule({ users, clock, ids }: UsersModuleDependencies) {
    return {
        signIn: new FindOrCreateUserFromIdentity(users, clock, ids),
        get: new GetUser(users),
        deleteAccount: new DeleteAccount(users)
    }
}

export type UsersModule = ReturnType<typeof createUsersModule>
