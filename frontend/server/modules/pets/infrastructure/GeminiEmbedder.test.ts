import { describe, expect, it, vi } from 'vitest'
import { ServiceUnavailableError } from '../../../shared/infrastructure/errors'
import { type EmbeddingsClient, GeminiEmbedder, UnavailableEmbedder } from './GeminiEmbedder'

const vector = (value: number) => Array.from({ length: 768 }, () => value)

function embedderReturning(embeddings: { values?: number[] }[], fetchImage = vi.fn()) {
    const embedContent = vi.fn().mockResolvedValue({ embeddings })
    const client = { models: { embedContent } } as unknown as EmbeddingsClient
    return { embedder: new GeminiEmbedder(client, 'gemini-embedding-2-preview', fetchImage), embedContent }
}

describe('GeminiEmbedder', () => {
    it('sends one inline image per content, truncated to the index dimensions', async () => {
        const fetchImage = vi
            .fn()
            .mockResolvedValue(
                new Response(Buffer.from('url-image'), { headers: { 'content-type': 'image/webp; charset=binary' } })
            )
        const { embedder, embedContent } = embedderReturning(
            [{ values: vector(0.1) }, { values: vector(0.2) }],
            fetchImage
        )

        const vectors = await embedder.embed([
            { kind: 'url', url: 'https://img.test/a.webp' },
            { kind: 'bytes', mimeType: 'image/jpeg', data: Buffer.from('raw-bytes') }
        ])

        expect(vectors).toEqual([vector(0.1), vector(0.2)])
        expect(fetchImage).toHaveBeenCalledWith('https://img.test/a.webp')
        expect(embedContent).toHaveBeenCalledWith({
            model: 'gemini-embedding-2-preview',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'image/webp', data: Buffer.from('url-image').toString('base64') } }
                    ]
                },
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: Buffer.from('raw-bytes').toString('base64') } }
                    ]
                }
            ],
            config: { outputDimensionality: 768 }
        })
    })

    it('embeds text queries and documents as text parts in the same request', async () => {
        const { embedder, embedContent } = embedderReturning([{ values: vector(0.3) }])

        expect(await embedder.embed([{ kind: 'text', text: 'perro negro' }])).toEqual([vector(0.3)])
        expect(embedContent.mock.calls[0]![0].contents).toEqual([{ role: 'user', parts: [{ text: 'perro negro' }] }])
        expect(embedder.available).toBe(true)
    })

    it('does not call the API for an empty list', async () => {
        const { embedder, embedContent } = embedderReturning([])

        expect(await embedder.embed([])).toEqual([])
        expect(embedContent).not.toHaveBeenCalled()
    })

    it('fails when an image cannot be downloaded', async () => {
        const fetchImage = vi.fn().mockResolvedValue(new Response('nope', { status: 404 }))
        const { embedder } = embedderReturning([], fetchImage)

        await expect(embedder.embed([{ kind: 'url', url: 'https://img.test/gone.jpg' }])).rejects.toThrow('404')
    })

    it.each([
        ['fewer embeddings than images', [{ values: vector(0.1) }]],
        ['the wrong dimensions', [{ values: [0.1, 0.2] }, { values: vector(0.1) }]],
        ['missing values', [{}, { values: vector(0.1) }]]
    ])('fails on %s', async (_, embeddings) => {
        const { embedder } = embedderReturning(embeddings)
        const image = { kind: 'bytes' as const, mimeType: 'image/png', data: Buffer.from('x') }

        await expect(embedder.embed([image, image])).rejects.toThrow('Unexpected embeddings')
    })
})

describe('UnavailableEmbedder', () => {
    it('reports the feature as unavailable', async () => {
        expect(new UnavailableEmbedder().available).toBe(false)
        await expect(new UnavailableEmbedder().embed()).rejects.toThrow(ServiceUnavailableError)
    })
})
