import type { Database } from '../../../shared/infrastructure/database'
import type { UserRepository } from '../application/ports'
import { User, type AuthProvider } from '../domain/User'

interface UserRow {
    id: string
    display_name: string
    created_at: Date
}

export class PostgresUserRepository implements UserRepository {
    constructor(private readonly sql: Database) {}

    async findById(id: string): Promise<User | null> {
        const [row] = await this.sql<UserRow[]>`select * from users where id = ${id}`
        return row ? toUser(row) : null
    }

    async findByIdentity(provider: AuthProvider, subject: string): Promise<User | null> {
        const [row] = await this.sql<UserRow[]>`
            select users.* from users
            join auth_identities on auth_identities.user_id = users.id
            where auth_identities.provider = ${provider} and auth_identities.subject = ${subject}
        `
        return row ? toUser(row) : null
    }

    async create(user: User, identity: { provider: AuthProvider; subject: string }): Promise<User> {
        const { id, displayName, createdAt } = user.toSnapshot()
        const created = await this.sql.begin(async sql => {
            await sql`
                insert into users (id, display_name, created_at)
                values (${id}, ${displayName}, ${createdAt})
            `
            const inserted = await sql`
                insert into auth_identities (provider, subject, user_id, created_at)
                values (${identity.provider}, ${identity.subject}, ${id}, ${createdAt})
                on conflict (provider, subject) do nothing
                returning user_id
            `
            // Lost a race with another first sign-in: undo the duplicate user.
            if (inserted.length === 0) await sql`delete from users where id = ${id}`
            return inserted.length > 0
        })
        if (created) return user
        const existing = await this.findByIdentity(identity.provider, identity.subject)
        if (!existing) throw new Error('Identity conflict without an existing user')
        return existing
    }

    async displayNames(ids: string[]): Promise<Map<string, string>> {
        if (ids.length === 0) return new Map()
        const rows = await this.sql<{ id: string; display_name: string }[]>`
            select id, display_name from users where id = any(${ids}::uuid[])
        `
        return new Map(rows.map(row => [row.id, row.display_name]))
    }

    async exists(id: string): Promise<boolean> {
        const [row] = await this.sql`select 1 from users where id = ${id}`
        return row !== undefined
    }

    async update(user: User): Promise<void> {
        const { id, displayName } = user.toSnapshot()
        await this.sql`update users set display_name = ${displayName} where id = ${id}`
    }

    async delete(id: string): Promise<void> {
        await this.sql`delete from users where id = ${id}`
    }
}

function toUser(row: UserRow): User {
    return User.restore({ id: row.id, displayName: row.display_name, createdAt: row.created_at })
}
