import type { Embedder, EmbeddingInput } from '../application/ports'

/**
 * Test double: returns the vector registered for each input (by URL, by text, or by the bytes as text),
 * so tests decide which photos and texts look alike.
 */
export class FakeEmbedder implements Embedder {
    readonly model = 'fake-embedder'
    readonly available = true
    readonly vectors = new Map<string, number[]>()
    readonly calls: EmbeddingInput[][] = []
    /** Vector for inputs without a registered one; undefined makes them fail. */
    fallback: number[] | undefined

    register(key: string, vector: number[]): this {
        this.vectors.set(key, vector)
        return this
    }

    async embed(inputs: EmbeddingInput[]): Promise<number[][]> {
        this.calls.push(inputs)
        return inputs.map(input => {
            const key =
                input.kind === 'url'
                    ? input.url
                    : input.kind === 'text'
                    ? input.text
                    : Buffer.from(input.data).toString()
            const vector = this.vectors.get(key) ?? this.fallback
            if (!vector) throw new Error(`No vector registered for ${key}`)
            return vector
        })
    }
}
