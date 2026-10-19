import { describe, expect, it, vi } from 'vitest'
import { type ChatCompletionsClient, DisabledPetDescriber, OpenAIPetDescriber } from './OpenAIPetDescriber'

const IMAGE = 'data:image/jpeg;base64,AAAA'

function describerAnswering(content: string | null) {
    const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] })
    const client = { chat: { completions: { create } } } as unknown as ChatCompletionsClient
    return { describer: new OpenAIPetDescriber(client, 'test-model'), create }
}

describe('OpenAIPetDescriber', () => {
    it('sends the image to the configured model asking for JSON', async () => {
        const { describer, create } = describerAnswering('{"isPet": false}')

        await describer.describe(IMAGE)

        const request = create.mock.calls[0]![0]
        expect(request.model).toBe('test-model')
        expect(request.response_format).toEqual({ type: 'json_object' })
        expect(request.messages[0].content).toContainEqual({ type: 'image_url', image_url: { url: IMAGE } })
    })

    it('maps a pet description, trimming text and turning blanks into null', async () => {
        const { describer } = describerAnswering(
            JSON.stringify({
                isPet: true,
                species: 'dog',
                description: '  Podenco blanco con manchas canela ',
                name: '',
                location: 'Sedaví',
                contact: null,
                eventDate: '2026-10-30'
            })
        )

        expect(await describer.describe(IMAGE)).toEqual({
            species: 'dog',
            description: 'Podenco blanco con manchas canela',
            name: null,
            location: 'Sedaví',
            contact: null,
            eventDate: '2026-10-30'
        })
    })

    it('drops values the model invents in the wrong format instead of failing', async () => {
        const { describer } = describerAnswering(
            JSON.stringify({ isPet: true, species: 'Perro', description: 'Perro', eventDate: '30/10/2026' })
        )

        expect(await describer.describe(IMAGE)).toMatchObject({ species: null, eventDate: null, name: null })
    })

    it.each([
        ['the image is not a pet', '{"isPet": false, "description": "Un coche"}'],
        ['the answer is not JSON', 'Sorry, I cannot help with that'],
        ['the answer is empty', null],
        ['isPet is missing', '{"species": "cat"}']
    ])('returns null when %s', async (_, content) => {
        const { describer } = describerAnswering(content)

        expect(await describer.describe(IMAGE)).toBeNull()
    })

    it('lets API errors propagate so the handler reports them', async () => {
        const create = vi.fn().mockRejectedValue(new Error('rate limited'))
        const client = { chat: { completions: { create } } } as unknown as ChatCompletionsClient

        await expect(new OpenAIPetDescriber(client, 'm').describe(IMAGE)).rejects.toThrow('rate limited')
    })
})

describe('DisabledPetDescriber', () => {
    it('never describes anything', async () => {
        expect(await new DisabledPetDescriber().describe()).toBeNull()
    })
})
