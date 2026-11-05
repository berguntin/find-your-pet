import type { Database } from '../../../shared/infrastructure/database'
import type { EmbeddingSource, PetEmbeddingIndex, PetEmbeddings, SimilarPet } from '../application/ports'

/** Must match the column types in the migration. */
export const EMBEDDING_DIMENSIONS = 768

export class PostgresPetEmbeddingIndex implements PetEmbeddingIndex {
    constructor(private readonly sql: Database) {}

    async replace(petId: string, model: string, { images, text }: PetEmbeddings): Promise<void> {
        for (const vector of [text, ...images.map(image => image.vector)]) assertDimensions(vector)

        await this.sql.begin(async transaction => {
            const sql = transaction as unknown as Database
            await sql`delete from pet_image_embeddings where pet_id = ${petId} and model = ${model}`
            for (const { imageUrl, vector } of images) {
                await sql`
                    insert into pet_image_embeddings (pet_id, image_url, model, embedding)
                    values (${petId}, ${imageUrl}, ${model}, ${toVector(vector)}::vector)
                `
            }
            await sql`
                insert into pet_text_embeddings (pet_id, model, embedding)
                values (${petId}, ${model}, ${toVector(text)}::vector)
                on conflict (pet_id, model) do update set embedding = excluded.embedding, created_at = now()
            `
        })
    }

    async remove(petId: string): Promise<void> {
        await this.sql`delete from pet_image_embeddings where pet_id = ${petId}`
        await this.sql`delete from pet_text_embeddings where pet_id = ${petId}`
    }

    async findSimilar(vector: number[], model: string, limit: number, source: EmbeddingSource): Promise<SimilarPet[]> {
        assertDimensions(vector)
        const query = toVector(vector)
        const table = this.sql(source === 'image' ? 'pet_image_embeddings' : 'pet_text_embeddings')
        // Nearest vectors first (served by the HNSW index), then the best vector per pet.
        const rows = await this.sql<{ pet_id: string; similarity: number }[]>`
            select pet_id, max(similarity)::float8 as similarity
            from (
                select pet_id, 1 - (embedding <=> ${query}::vector) as similarity
                from ${table}
                where model = ${model}
                order by embedding <=> ${query}::vector
                limit ${limit * 4}
            ) nearest
            group by pet_id
            order by similarity desc
            limit ${limit}
        `
        return rows.map(row => ({ petId: row.pet_id, similarity: Number(row.similarity) }))
    }

    async findIndexed(petIds: string[], model: string): Promise<Set<string>> {
        if (petIds.length === 0) return new Set()
        // Every indexed pet has a text vector, even without photos.
        const rows = await this.sql<{ pet_id: string }[]>`
            select pet_id from pet_text_embeddings where model = ${model} and pet_id in ${this.sql(petIds)}
        `
        return new Set(rows.map(row => row.pet_id))
    }
}

function toVector(vector: number[]): string {
    return `[${vector.join(',')}]`
}

function assertDimensions(vector: number[]): void {
    if (vector.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}`)
    }
}
