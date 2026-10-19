import type { EmbeddingSource, PetEmbeddingIndex, PetEmbeddings, SimilarPet } from '../application/ports'

/** Test double with exact cosine similarity. */
export class InMemoryPetEmbeddingIndex implements PetEmbeddingIndex {
    readonly entries = new Map<string, { model: string } & PetEmbeddings>()

    async replace(petId: string, model: string, embeddings: PetEmbeddings): Promise<void> {
        this.entries.set(petId, { model, ...embeddings })
    }

    async remove(petId: string): Promise<void> {
        this.entries.delete(petId)
    }

    async findSimilar(vector: number[], model: string, limit: number, source: EmbeddingSource): Promise<SimilarPet[]> {
        return [...this.entries]
            .filter(([, entry]) => entry.model === model)
            .map(([petId, entry]) => {
                const vectors = source === 'image' ? entry.images.map(image => image.vector) : [entry.text]
                return { petId, similarity: Math.max(...vectors.map(v => cosine(vector, v))) }
            })
            .filter(result => Number.isFinite(result.similarity))
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
    }
}

export function cosine(a: number[], b: number[]): number {
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!
        normA += a[i]! * a[i]!
        normB += b[i]! * b[i]!
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
