import OpenAI from 'openai'
import { z } from 'zod'
import type { PetDescriber, PetDescription } from '../application/ports'
import { SPECIES } from '../domain/values'

const PROMPT = `You extract information from a photo or poster of a lost or found pet.
Answer with a JSON object with this exact shape:
{
  "isPet": boolean,             // false if the image does not show a pet or a pet poster
  "species": "dog" | "cat" | "other" | null,
  "description": string | null, // short, objective description in SPANISH of the animal itself (see below)
  "name": string | null,        // only if written in the image
  "location": string | null,    // usually a town name, only if written in the image
  "contact": string | null,     // phone, email or social profile, only the value
  "eventDate": string | null    // YYYY-MM-DD, only if written in the image
}
The description must help someone recognise the animal days later, wherever it is.

1. ALWAYS start with the most likely breed (for a dog or a cat), using the breed names commonly used in Spain:
   - a clear breed: name it ("Podenco andaluz", "Yorkshire terrier", "Gato siamés");
   - a mix that resembles a breed: "Cruce de <breed>" or "Mestizo tipo <breed>";
   - no recognisable breed: "Perro mestizo" or "Gato común europeo".
   If you are not sure it is purebred, say "tipo" or "cruce de" instead of stating the breed as a fact.
   If a poster states the breed in writing, use that instead of your own estimate.
2. Then, in this order and only when visible: size (pequeño, mediano, grande) and build; apparent age only
   if obvious (cachorro, mayor); coat colour, pattern and length; eye colour; ear and tail shape; and
   distinctive permanent marks (spots, scars, a missing eye or limb, a docked tail...).
3. Describe ONLY its own, permanent physical traits. NEVER mention anything the animal could lose or that
   belongs to the photo: collars, harnesses, leads, tags, clothes, toys, objects it carries, people, the
   place, the background, its pose, mood or what it is doing. No subjective words ("bonito", "precioso").
4. One or two short sentences, at most about 40 words. Examples:
   "Podenco andaluz mediano, blanco con manchas canela en la cabeza, orejas grandes y erguidas."
   "Cruce de pastor alemán grande, pelo corto negro y fuego, orejas erguidas y cola larga."
   "Gato común europeo atigrado gris, pelo corto, ojos verdes y una mancha blanca en el pecho."
Use null for anything you cannot read in the image. Never invent data other than the breed estimate.`

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

/** The slice of the OpenAI SDK this adapter uses, so tests can replace it. */
export type ChatCompletionsClient = Pick<OpenAI, 'chat'>

export function createOpenAIClient(apiKey: string): OpenAI {
    return new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 })
}

export class OpenAIPetDescriber implements PetDescriber {
    constructor(private readonly client: ChatCompletionsClient, private readonly model: string) {}

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
