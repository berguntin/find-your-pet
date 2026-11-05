import type OpenAI from 'openai'
import type { ContentModerator, ModerationSubmission } from '../application/ports'
import type { ModerationScores } from '../domain/moderation'

/** The slice of the OpenAI SDK this adapter uses, so tests can replace it. */
export type DecisionsClient = Pick<OpenAI, 'decisions'>

const QUESTIONS = [
    {
        type: 'predicate',
        name: 'is_pet_report',
        instructions:
            'Is this a genuine notice about a pet that someone lost or found (a dog, cat or other companion animal)?'
    },
    {
        type: 'predicate',
        name: 'shows_animal',
        instructions: 'Do the images show an animal, or a poster or flyer about a lost or found animal?'
    },
    {
        type: 'predicate',
        name: 'inappropriate',
        instructions:
            'Does the notice contain spam, advertising, offensive or hateful language, sexual content or gratuitous violence? ' +
            'A pet found injured or dead, described respectfully, is NOT inappropriate.'
    }
] as const

const SPECIES_LABEL = { dog: 'dog', cat: 'cat', other: 'other animal' } as const

/** Asks the OpenAI Decisions API how likely a report is to be a genuine, acceptable lost/found pet notice. */
export class OpenAIDecisionsModerator implements ContentModerator {
    constructor(private readonly client: DecisionsClient, readonly model: string) {}

    async review(submission: ModerationSubmission): Promise<ModerationScores> {
        const decision = await this.client.decisions.create(
            {
                model: this.model,
                input: [
                    {
                        role: 'user',
                        content: [
                            { type: 'input_text', text: describe(submission) },
                            ...submission.images.map(url => ({
                                type: 'input_image' as const,
                                image_url: url,
                                detail: 'low' as const
                            }))
                        ]
                    }
                ],
                questions: QUESTIONS.map(question => ({ ...question }))
            },
            { timeout: 10_000, maxRetries: 1 }
        )

        const probability = (name: string): number | null => {
            const answer = decision.answers.find(a => a.name === name)
            return answer?.type === 'predicate' ? answer.probability : null
        }

        return {
            isPetReport: probability('is_pet_report'),
            showsAnimal: probability('shows_animal'),
            inappropriate: probability('inappropriate')
        }
    }
}

/**
 * Used when no OpenAI key is configured. In development it approves everything so the app is usable;
 * otherwise it fails, which sends every report to manual review instead of publishing it unchecked.
 */
export class DisabledContentModerator implements ContentModerator {
    readonly model = null

    constructor(private readonly approveEverything: boolean) {}

    async review(): Promise<ModerationScores> {
        if (!this.approveEverything) throw new Error('Content moderation is not configured')
        return { isPetReport: 1, showsAnimal: 1, inappropriate: 0 }
    }
}

function describe(submission: ModerationSubmission): string {
    return [
        `Notice type: ${submission.reportType === 'lost' ? 'I lost my pet' : 'I found a pet'}`,
        `Animal: ${SPECIES_LABEL[submission.species]}`,
        `Name: ${submission.name ?? '(unknown)'}`,
        `Description: ${submission.description}`,
        `Location: ${submission.location}`,
        `Contact: ${submission.contact}`
    ].join('\n')
}
