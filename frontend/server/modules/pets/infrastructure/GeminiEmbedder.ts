import type { GoogleGenAI } from '@google/genai'
import { ServiceUnavailableError } from '../../../shared/infrastructure/errors'
import type { Embedder, EmbeddingInput } from '../application/ports'
import { EMBEDDING_DIMENSIONS } from './PostgresPetEmbeddingIndex'

/** The slice of the Google GenAI SDK this adapter uses, so tests can replace it. */
export type EmbeddingsClient = Pick<GoogleGenAI, 'models'>

type Fetch = (url: string) => Promise<Response>

/**
 * Multimodal embeddings with Gemini Embedding 2, truncated to the index dimensions.
 * Text and images land in the same space, which is what lets a text query find photos.
 */
export class GeminiEmbedder implements Embedder {
    constructor(
        private readonly client: EmbeddingsClient,
        readonly model: string,
        private readonly fetchImage: Fetch = url => fetch(url, { signal: AbortSignal.timeout(10_000) })
    ) {}

    readonly available = true

    async embed(inputs: EmbeddingInput[]): Promise<number[][]> {
        if (inputs.length === 0) return []
        const parts = await Promise.all(inputs.map(input => this.toPart(input)))

        const response = await this.client.models.embedContent({
            model: this.model,
            // One content per input: one embedding per input, in order.
            contents: parts.map(part => ({ role: 'user', parts: [part] })),
            config: { outputDimensionality: EMBEDDING_DIMENSIONS }
        })

        const vectors = (response.embeddings ?? []).map(embedding => embedding.values ?? [])
        if (vectors.length !== inputs.length || vectors.some(v => v.length !== EMBEDDING_DIMENSIONS)) {
            throw new Error(`Unexpected embeddings from ${this.model}: ${vectors.map(v => v.length).join(',')}`)
        }
        return vectors
    }

    private async toPart(input: EmbeddingInput) {
        if (input.kind === 'text') return { text: input.text }
        if (input.kind === 'bytes') {
            return { inlineData: { mimeType: input.mimeType, data: Buffer.from(input.data).toString('base64') } }
        }
        const response = await this.fetchImage(input.url)
        if (!response.ok) throw new Error(`Could not download ${input.url}: ${response.status}`)
        return {
            inlineData: {
                mimeType: response.headers.get('content-type')?.split(';')[0] || 'image/jpeg',
                data: Buffer.from(await response.arrayBuffer()).toString('base64')
            }
        }
    }
}

/**
 * Used when no Gemini key is configured: image search answers 503, text search falls back to
 * keywords and nothing is indexed.
 */
export class UnavailableEmbedder implements Embedder {
    readonly model = 'unavailable'
    readonly available = false

    async embed(): Promise<number[][]> {
        throw new ServiceUnavailableError('Image search is not available')
    }
}
