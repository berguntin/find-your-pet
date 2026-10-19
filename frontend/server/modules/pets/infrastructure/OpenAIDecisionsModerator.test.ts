import { describe, expect, it, vi } from 'vitest'
import type { ModerationSubmission } from '../application/ports'
import { type DecisionsClient, DisabledContentModerator, OpenAIDecisionsModerator } from './OpenAIDecisionsModerator'

const submission: ModerationSubmission = {
    reportType: 'found',
    species: 'dog',
    name: null,
    description: 'Perro mestizo con collar azul',
    location: 'Paiporta',
    contact: '600000000',
    images: ['https://img.test/a.jpg', 'https://img.test/b.jpg']
}

function moderatorAnswering(answers: unknown[]) {
    const create = vi.fn().mockResolvedValue({ answers, model: 'gpt-6-luna', usage: {} })
    const client = { decisions: { create } } as unknown as DecisionsClient
    return { moderator: new OpenAIDecisionsModerator(client, 'gpt-6-luna'), create }
}

const predicate = (name: string, probability: number) => ({ type: 'predicate', name, probability })

describe('OpenAIDecisionsModerator', () => {
    it('asks the three questions about the text and every image', async () => {
        const { moderator, create } = moderatorAnswering([])

        await moderator.review(submission)

        const [body, options] = create.mock.calls[0]!
        expect(body.model).toBe('gpt-6-luna')
        expect(body.questions.map((q: { name: string; type: string }) => [q.name, q.type])).toEqual([
            ['is_pet_report', 'predicate'],
            ['shows_animal', 'predicate'],
            ['inappropriate', 'predicate']
        ])
        const content = body.input[0].content
        expect(content[0].type).toBe('input_text')
        expect(content[0].text).toContain('I found a pet')
        expect(content[0].text).toContain('Perro mestizo con collar azul')
        expect(content[0].text).toContain('Name: (unknown)')
        expect(content.slice(1)).toEqual([
            { type: 'input_image', image_url: 'https://img.test/a.jpg', detail: 'low' },
            { type: 'input_image', image_url: 'https://img.test/b.jpg', detail: 'low' }
        ])
        expect(options).toMatchObject({ timeout: 10_000 })
    })

    it('maps answers by name, whatever their order', async () => {
        const { moderator } = moderatorAnswering([
            predicate('inappropriate', 0.02),
            predicate('is_pet_report', 0.97),
            predicate('shows_animal', 0.88)
        ])

        expect(await moderator.review(submission)).toEqual({
            isPetReport: 0.97,
            showsAnimal: 0.88,
            inappropriate: 0.02
        })
    })

    it('turns refusals and missing answers into null', async () => {
        const { moderator } = moderatorAnswering([
            { type: 'refusal', name: 'inappropriate' },
            predicate('is_pet_report', 0.9)
        ])

        expect(await moderator.review(submission)).toEqual({
            isPetReport: 0.9,
            showsAnimal: null,
            inappropriate: null
        })
    })

    it('lets API errors propagate so the use case sends the report to review', async () => {
        const create = vi.fn().mockRejectedValue(new Error('503'))
        const moderator = new OpenAIDecisionsModerator({ decisions: { create } } as unknown as DecisionsClient, 'm')

        await expect(moderator.review(submission)).rejects.toThrow('503')
    })
})

describe('DisabledContentModerator', () => {
    it('approves everything in development', async () => {
        expect(await new DisabledContentModerator(true).review()).toEqual({
            isPetReport: 1,
            showsAnimal: 1,
            inappropriate: 0
        })
    })

    it('fails elsewhere, so reports go to manual review', async () => {
        await expect(new DisabledContentModerator(false).review()).rejects.toThrow(/not configured/)
    })
})
