import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDatabase } from '../../../shared/infrastructure/database'
import { Pet } from '../domain/Pet'
import { EMBEDDING_DIMENSIONS, PostgresPetEmbeddingIndex } from './PostgresPetEmbeddingIndex'
import { PostgresPetRepository } from './PostgresPetRepository'

/** Integration tests: need TEST_DATABASE_URL pointing to a migrated Postgres with pgvector. */
const url = process.env.TEST_DATABASE_URL

/** A unit vector pointing mostly along `axis`, tilted by `tilt` towards the next axis. */
const vector = (axis: number, tilt = 0) => {
    const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0)
    v[axis] = 1
    v[axis + 1] = tilt
    return v
}

describe.skipIf(!url)('PostgresPetEmbeddingIndex', () => {
    const sql = createDatabase(url!)
    const index = new PostgresPetEmbeddingIndex(sql)
    const pets = new PostgresPetRepository(sql)
    const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002']

    beforeEach(async () => {
        await sql`delete from pets`
        for (const id of ids) {
            await pets.save(
                Pet.report(
                    {
                        reportType: 'lost',
                        species: 'dog',
                        description: 'Perro',
                        location: 'Paiporta',
                        contact: '600000000',
                        images: ['https://img/1.jpg', 'https://img/2.jpg'],
                        eventDate: '2026-10-01'
                    },
                    { id, now: new Date('2026-10-19T10:00:00Z') }
                )
            )
        }
    })

    afterAll(async () => {
        await sql.end()
    })

    it('finds the closest pets with the best image of each, most similar first', async () => {
        await index.replace(ids[0]!, 'model-a', {
            images: [
                { imageUrl: 'https://img/1.jpg', vector: vector(5) },
                { imageUrl: 'https://img/2.jpg', vector: vector(0, 0.1) }
            ],
            text: vector(9)
        })
        await index.replace(ids[1]!, 'model-a', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(0, 1) }],
            text: vector(9)
        })

        const results = await index.findSimilar(vector(0), 'model-a', 10, 'image')

        expect(results.map(r => r.petId)).toEqual(ids)
        expect(results[0]!.similarity).toBeCloseTo(1 / Math.sqrt(1.01), 5)
        expect(results[1]!.similarity).toBeCloseTo(1 / Math.sqrt(2), 5)
    })

    it('only compares vectors of the same model and respects the limit', async () => {
        await index.replace(ids[0]!, 'model-a', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(0) }],
            text: vector(9)
        })
        await index.replace(ids[1]!, 'model-b', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(0) }],
            text: vector(9)
        })

        expect((await index.findSimilar(vector(0), 'model-a', 10, 'image')).map(r => r.petId)).toEqual([ids[0]])
        expect(await index.findSimilar(vector(0), 'model-a', 0, 'image')).toEqual([])
    })

    it('replaces the vectors of a pet, and removes them', async () => {
        await index.replace(ids[0]!, 'model-a', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(0) }],
            text: vector(9)
        })
        await index.replace(ids[0]!, 'model-a', {
            images: [{ imageUrl: 'https://img/2.jpg', vector: vector(3) }],
            text: vector(9)
        })

        expect(await sql`select image_url from pet_image_embeddings`).toEqual([{ image_url: 'https://img/2.jpg' }])
        expect(await sql`select 1 from pet_text_embeddings`).toHaveLength(1)
        await index.remove(ids[0]!)
        expect(await sql`select 1 from pet_image_embeddings`).toHaveLength(0)
        expect(await sql`select 1 from pet_text_embeddings`).toHaveLength(0)
    })

    it('drops the vectors when the pet is deleted', async () => {
        await index.replace(ids[0]!, 'model-a', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(0) }],
            text: vector(9)
        })
        await pets.delete(ids[0]!)

        expect(await sql`select 1 from pet_image_embeddings`).toHaveLength(0)
        expect(await sql`select 1 from pet_text_embeddings`).toHaveLength(0)
    })

    it('searches report texts separately from photos', async () => {
        await index.replace(ids[0]!, 'model-a', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(5) }],
            text: vector(0)
        })
        await index.replace(ids[1]!, 'model-a', {
            images: [{ imageUrl: 'https://img/1.jpg', vector: vector(0) }],
            text: vector(5)
        })

        expect((await index.findSimilar(vector(0), 'model-a', 1, 'text')).map(r => r.petId)).toEqual([ids[0]])
        expect((await index.findSimilar(vector(0), 'model-a', 1, 'image')).map(r => r.petId)).toEqual([ids[1]])
    })

    it('rejects vectors with the wrong dimensions', async () => {
        await expect(
            index.replace(ids[0]!, 'm', { images: [{ imageUrl: 'x', vector: [1, 2] }], text: vector(0) })
        ).rejects.toThrow('768')
        await expect(index.replace(ids[0]!, 'm', { images: [], text: [1, 2] })).rejects.toThrow('768')
        await expect(index.findSimilar([1, 2], 'm', 1, 'text')).rejects.toThrow('768')
    })

    it('loads several pets by id', async () => {
        expect((await pets.findByIds([...ids, '00000000-0000-4000-8000-000000000009'])).map(p => p.id).sort()).toEqual(
            ids
        )
        expect(await pets.findByIds([])).toEqual([])
    })
})
