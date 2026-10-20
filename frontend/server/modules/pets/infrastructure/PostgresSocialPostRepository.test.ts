import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../../shared/infrastructure/database'
import { PostgresSocialPostRepository } from './PostgresSocialPostRepository'

/** Integration tests: need TEST_DATABASE_URL pointing to a migrated Postgres. They empty pet_social_posts. */
const url = process.env.TEST_DATABASE_URL

describe.skipIf(!url)('PostgresSocialPostRepository', () => {
    const sql = createDatabase(url!)
    const posts = new PostgresSocialPostRepository(sql)
    const petId = '00000000-0000-4000-8000-000000000001'

    beforeEach(async () => {
        await sql`delete from pet_social_posts`
    })

    afterAll(async () => {
        await sql.end()
    })

    it('stores, finds and removes the post of a pet on a network', async () => {
        await posts.save(petId, 'facebook', 'page_post-1', new Date('2026-10-20T10:00:00Z'))

        expect(await posts.find(petId, 'facebook')).toBe('page_post-1')
        expect(await posts.find(petId, 'instagram')).toBeNull()

        await posts.remove(petId, 'facebook')
        expect(await posts.find(petId, 'facebook')).toBeNull()
    })

    it('keeps the post of a pet that no longer exists, so it can still be deleted', async () => {
        // The pet id does not exist in `pets`: there is no foreign key on purpose.
        await posts.save(petId, 'facebook', 'page_post-1', new Date('2026-10-20T10:00:00Z'))

        expect(await posts.find(petId, 'facebook')).toBe('page_post-1')
    })

    it('replaces the post id when saved again', async () => {
        await posts.save(petId, 'facebook', 'page_post-1', new Date('2026-10-20T10:00:00Z'))
        await posts.save(petId, 'facebook', 'page_post-2', new Date('2026-10-20T11:00:00Z'))

        expect(await posts.find(petId, 'facebook')).toBe('page_post-2')
    })
})
