/**
 * Evaluates the image embedding model on a folder of labelled photos and suggests the match calibration.
 *
 *   NUXT_GEMINI_API_KEY=... npm run eval:embeddings -- <dataset-dir> [--model gemini-embedding-2-preview]
 *
 * The dataset has one folder per animal with two or more photos of it (other animals can have just one):
 *   dataset/rex/1.jpg, dataset/rex/2.jpg, dataset/luna/a.png, ...
 * Embeddings are cached in <dataset-dir>/.embeddings-<model>.json, so re-runs cost nothing.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { parseArgs } from 'node:util'
import { GoogleGenAI } from '@google/genai'
import { GeminiEmbedder } from '../server/modules/pets/infrastructure/GeminiEmbedder'
import { evaluate, type LabeledVector } from './lib/evaluation'

const MIME_BY_EXTENSION: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp'
}
const BATCH_SIZE = 8

const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { model: { type: 'string', default: 'gemini-embedding-2-preview' } }
})
const datasetDir = positionals[0]
const apiKey = process.env.NUXT_GEMINI_API_KEY
if (!datasetDir || !apiKey) {
    console.error('Usage: NUXT_GEMINI_API_KEY=... npm run eval:embeddings -- <dataset-dir> [--model <model>]')
    process.exit(1)
}

const photos = readdirSync(datasetDir)
    .filter(animal => !animal.startsWith('.') && statSync(join(datasetDir, animal)).isDirectory())
    .flatMap(animal =>
        readdirSync(join(datasetDir, animal))
            .filter(file => extname(file).toLowerCase() in MIME_BY_EXTENSION)
            .sort()
            .map(file => ({ animalId: animal, path: join(datasetDir, animal, file) }))
    )

const cachePath = join(datasetDir, `.embeddings-${values.model}.json`)
const cache: Record<string, number[]> = existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {}
const embedder = new GeminiEmbedder(new GoogleGenAI({ apiKey }), values.model!)

const missing = photos.filter(photo => !cache[relative(datasetDir, photo.path)])
console.log(`${photos.length} photos, ${missing.length} to embed with ${values.model}`)
for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE)
    const vectors = await embedder.embed(
        batch.map(photo => ({
            kind: 'bytes' as const,
            mimeType: MIME_BY_EXTENSION[extname(photo.path).toLowerCase()]!,
            data: readFileSync(photo.path)
        }))
    )
    batch.forEach((photo, j) => (cache[relative(datasetDir, photo.path)] = vectors[j]!))
    writeFileSync(cachePath, JSON.stringify(cache))
    console.log(`  ${Math.min(i + BATCH_SIZE, missing.length)}/${missing.length}`)
}

const items: LabeledVector[] = photos.map(photo => ({
    animalId: photo.animalId,
    photo: photo.path,
    vector: cache[relative(datasetDir, photo.path)]!
}))
const report = evaluate(items)

console.log(JSON.stringify(report, null, 2))
if (report.suggestedCalibration) {
    console.log('\nSuggested configuration:')
    console.log(`NUXT_IMAGE_SEARCH_MATCH_FLOOR=${report.suggestedCalibration.floor}`)
    console.log(`NUXT_IMAGE_SEARCH_MATCH_CEILING=${report.suggestedCalibration.ceiling}`)
} else {
    console.log('\nThe model does not separate same and different animals well enough to calibrate it.')
}
