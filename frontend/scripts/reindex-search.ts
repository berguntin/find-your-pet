/**
 * Recomputes the search embeddings (photos and text) of every published pet, e.g. after changing the model.
 * Reads the same NUXT_* variables as the app (database, Cloudinary and Gemini).
 *
 *   npm run reindex:search
 */
import { GoogleGenAI } from '@google/genai'
import { IndexPetForSearch } from '../server/modules/pets/application/search'
import { CloudinaryImageStorage } from '../server/modules/pets/infrastructure/CloudinaryImageStorage'
import { GeminiEmbedder } from '../server/modules/pets/infrastructure/GeminiEmbedder'
import { PostgresPetEmbeddingIndex } from '../server/modules/pets/infrastructure/PostgresPetEmbeddingIndex'
import { PostgresPetRepository } from '../server/modules/pets/infrastructure/PostgresPetRepository'
import { createDatabase } from '../server/shared/infrastructure/database'

const env = (name: string) => {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

const sql = createDatabase(env('NUXT_DATABASE_URL'))
const clock = { now: () => new Date() }
const pets = new PostgresPetRepository(sql)
const indexForSearch = new IndexPetForSearch(
    pets,
    new CloudinaryImageStorage(
        {
            cloudName: env('NUXT_CLOUDINARY_CLOUD_NAME'),
            apiKey: env('NUXT_CLOUDINARY_API_KEY'),
            apiSecret: env('NUXT_CLOUDINARY_API_SECRET'),
            folder: process.env.NUXT_CLOUDINARY_FOLDER || 'pets'
        },
        clock
    ),
    new GeminiEmbedder(
        new GoogleGenAI({ apiKey: env('NUXT_GEMINI_API_KEY') }),
        process.env.NUXT_GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2-preview'
    ),
    new PostgresPetEmbeddingIndex(sql)
)

let indexed = 0
let failed = 0
let cursor: string | undefined
do {
    const page = await pets.search({ moderationStatus: 'approved', limit: 50, cursor })
    for (const pet of page.items) {
        try {
            await indexForSearch.execute(pet.id)
            indexed++
        } catch (error) {
            failed++
            console.error(`Could not index ${pet.id}:`, error)
        }
    }
    cursor = page.nextCursor ?? undefined
    console.log(`Indexed ${indexed}, failed ${failed}`)
} while (cursor)

await sql.end()
process.exit(failed > 0 ? 1 : 0)
