import type { SocialPostRepository } from '../application/ports'

/** Test double that keeps social posts in memory. */
export class InMemorySocialPostRepository implements SocialPostRepository {
    readonly posts = new Map<string, { postId: string; publishedAt: Date }>()

    async find(petId: string, network: string): Promise<string | null> {
        return this.posts.get(key(petId, network))?.postId ?? null
    }

    async save(petId: string, network: string, postId: string, publishedAt: Date): Promise<void> {
        this.posts.set(key(petId, network), { postId, publishedAt })
    }

    async remove(petId: string, network: string): Promise<void> {
        this.posts.delete(key(petId, network))
    }
}

const key = (petId: string, network: string) => `${network}:${petId}`
