import type { Database } from '../../../shared/infrastructure/database'
import type { SocialPostRepository } from '../application/ports'

export class PostgresSocialPostRepository implements SocialPostRepository {
    constructor(private readonly sql: Database) {}

    async find(petId: string, network: string): Promise<string | null> {
        const [row] = await this.sql<{ post_id: string }[]>`
            select post_id from pet_social_posts where pet_id = ${petId} and network = ${network}
        `
        return row?.post_id ?? null
    }

    async save(petId: string, network: string, postId: string, publishedAt: Date): Promise<void> {
        await this.sql`
            insert into pet_social_posts (pet_id, network, post_id, published_at)
            values (${petId}, ${network}, ${postId}, ${publishedAt})
            on conflict (pet_id, network) do update set post_id = excluded.post_id, published_at = excluded.published_at
        `
    }

    async remove(petId: string, network: string): Promise<void> {
        await this.sql`delete from pet_social_posts where pet_id = ${petId} and network = ${network}`
    }
}
