import OpenAI from 'openai'
import { z } from 'zod'
import type { PetDescriber, PetDescription } from '../application/ports'
import { SPECIES } from '../domain/values'

const PROMPT = `You extract information from a photo or poster of a lost or found pet.
Answer with a JSON object with this exact shape:
{
  "isPet": boolean,             // false if the image does not show a pet or a pet poster
  "species": "dog" | "cat" | "other" | null,
  "description": string | null, // short, objective description in SPANISH that helps identify the animal:
                                // breed, colours, size, marks, collar... no mood or attitude
  "name": string | null,        // only if written in the image
  "location": string | null,    // usually a town name, only if written in the image
  "contact": string | null,     // phone, email or social profile, only the value
  "eventDate": string | null    // YYYY-MM-DD, only if written in the image
}
Use null for anything you cannot read in the image. Never invent data.`

const nullableText = z
    .string()
    .nullish()
    .transform(value => value?.trim() || null)

const responseSchema = z.object({
    isPet: z.boolean(),
    species: z.enum(SPECIES).nullish().catch(null),
    description: nullableText,
    name: nullableText,
    location: nullableText,
    contact: nullableText,
    eventDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullish()
        .catch(null)
})

export class OpenAIPetDescriber implements PetDescriber {
    private readonly client: OpenAI

    constructor(
        apiKey: string,
        private readonly model: string
    ) {
        this.client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 })
    }

    async describe(imageDataUrl: string): Promise<PetDescription | null> {
        const completion = await this.client.chat.completions.create({
            model: this.model,
            max_tokens: 600,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: PROMPT },
                        { type: 'image_url', image_url: { url: imageDataUrl } }
                    ]
                }
            ]
        })

        const parsed = responseSchema.safeParse(safeJson(completion.choices[0]?.message.content))
        if (!parsed.success || !parsed.data.isPet) return null

        const { isPet: _isPet, ...description } = parsed.data
        return { ...description, species: description.species ?? null, eventDate: description.eventDate ?? null }
    }
}

/** Used when no OpenAI key is configured: the form is then filled by hand. */
export class DisabledPetDescriber implements PetDescriber {
    async describe(): Promise<PetDescription | null> {
        return null
    }
}

function safeJson(text: string | null | undefined): unknown {
    try {
        return JSON.parse(text ?? '')
    } catch {
        return null
    }
}
