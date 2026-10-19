import type { Page } from '../../../shared/application/ports'
import { matchPercentage, type MatchCalibration } from '../domain/matchScore'
import type { Pet, PetProps } from '../domain/Pet'
import type { Embedder, ImageStorage, PetEmbeddingIndex, PetRepository, PetSearchCriteria } from './ports'

/** Images are embedded at this size: enough detail to tell animals apart, fewer bytes to send. */
const EMBEDDING_IMAGE_SIZE = 512

const SPECIES_TEXT = { dog: 'Perro', cat: 'Gato', other: 'Animal' } as const
const REPORT_TEXT = { lost: 'perdido', found: 'encontrado' } as const

/** The text that represents a pet in semantic search, in Spanish like the reports themselves. */
export function petSearchText(pet: Readonly<PetProps>): string {
    return [
        `${SPECIES_TEXT[pet.species]} ${REPORT_TEXT[pet.reportType]}.`,
        pet.name ? `Se llama ${pet.name}.` : '',
        pet.description,
        `Zona: ${pet.location}.`
    ]
        .filter(Boolean)
        .join(' ')
}

/**
 * Keeps the search index in sync with a pet: one vector per photo and one for its text.
 * Idempotent, so it can run again on retries. Pets that are not public are removed from the index.
 */
export class IndexPetForSearch {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly embedder: Embedder,
        private readonly index: PetEmbeddingIndex
    ) {}

    async execute(petId: string): Promise<void> {
        const pet = await this.pets.findById(petId)
        if (!pet || !pet.isPublic) {
            await this.index.remove(petId)
            return
        }

        const snapshot = pet.toSnapshot()
        const vectors = await this.embedder.embed([
            ...snapshot.images.map(url => ({
                kind: 'url' as const,
                url: this.images.previewUrl(url, EMBEDDING_IMAGE_SIZE)
            })),
            { kind: 'text', text: petSearchText(snapshot) }
        ])
        await this.index.replace(pet.id, this.embedder.model, {
            images: snapshot.images.map((imageUrl, i) => ({ imageUrl, vector: vectors[i]! })),
            text: vectors.at(-1)!
        })
    }
}

export interface PetMatch {
    pet: Pet
    /** 0–100, already calibrated. */
    match: number
}

export interface SearchImage {
    mimeType: string
    data: Uint8Array
}

/** Finds public, still-open pets that look like the animal in a photo. The photo is never stored. */
export class SearchPetsByImage {
    constructor(
        private readonly pets: PetRepository,
        private readonly embedder: Embedder,
        private readonly index: PetEmbeddingIndex,
        private readonly calibration: MatchCalibration
    ) {}

    async execute(image: SearchImage, limit = 12): Promise<PetMatch[]> {
        const [vector] = await this.embedder.embed([{ kind: 'bytes', mimeType: image.mimeType, data: image.data }])
        if (!vector) return []

        // Ask for extra candidates: some will be hidden, reunited or below the threshold.
        const similar = await this.index.findSimilar(vector, this.embedder.model, limit * 3, 'image')
        const pets = new Map((await this.pets.findByIds(similar.map(s => s.petId))).map(pet => [pet.id, pet]))

        return similar
            .flatMap(({ petId, similarity }) => {
                const pet = pets.get(petId)
                const match = matchPercentage(similarity, this.calibration)
                if (!pet || !pet.isPublic || pet.isReunited || match === null) return []
                return [{ pet, match }]
            })
            .slice(0, limit)
    }
}

/**
 * Calibrations for text queries. Text-to-text and text-to-photo similarities live on different
 * scales, so each has its own; both turn into the same 0–100 relevance to rank results together.
 */
export interface SemanticSearchCalibration {
    text: MatchCalibration
    image: MatchCalibration
}

export type SemanticFilters = Omit<PetSearchCriteria, 'query' | 'cursor' | 'limit' | 'moderationStatus'>

/**
 * "perro negro" finds black dogs even if no report contains those words: the query is compared with
 * the text of each report and, as the space is multimodal, with the photos themselves.
 */
export class SearchPetsByText {
    constructor(
        private readonly pets: PetRepository,
        private readonly embedder: Embedder,
        private readonly index: PetEmbeddingIndex,
        private readonly calibration: SemanticSearchCalibration
    ) {}

    get available(): boolean {
        return this.embedder.available
    }

    async execute(query: string, filters: SemanticFilters, limit = 60): Promise<PetMatch[]> {
        const [vector] = await this.embedder.embed([{ kind: 'text', text: query }])
        if (!vector) return []

        const candidates = limit * 3
        const [byText, byImage] = await Promise.all([
            this.index.findSimilar(vector, this.embedder.model, candidates, 'text'),
            this.index.findSimilar(vector, this.embedder.model, candidates, 'image')
        ])

        const relevance = new Map<string, number>()
        const keepBest = (petId: string, match: number | null) => {
            if (match !== null) relevance.set(petId, Math.max(relevance.get(petId) ?? 0, match))
        }
        byText.forEach(({ petId, similarity }) => keepBest(petId, matchPercentage(similarity, this.calibration.text)))
        byImage.forEach(({ petId, similarity }) => keepBest(petId, matchPercentage(similarity, this.calibration.image)))

        const pets = await this.pets.findByIds([...relevance.keys()])
        return pets
            .filter(pet => pet.isPublic && matchesFilters(pet, filters))
            .map(pet => ({ pet, match: relevance.get(pet.id)! }))
            .sort((a, b) => b.match - a.match)
            .slice(0, limit)
    }
}

/**
 * Public text search. Exact keyword hits (names, phones, towns) come first, then semantic matches.
 * Without semantic search (not configured, rate limited or failing) it is the plain paginated keyword search.
 */
export class SearchPets {
    constructor(
        private readonly pets: PetRepository,
        private readonly semantic: SearchPetsByText,
        private readonly reportError: (error: unknown, context: string) => void
    ) {}

    async execute(
        criteria: Omit<PetSearchCriteria, 'moderationStatus'>,
        options: { semantic: boolean }
    ): Promise<Page<Pet>> {
        const keyword = await this.pets.search({ ...criteria, moderationStatus: 'approved' })
        if (!criteria.query || !options.semantic || !this.semantic.available || criteria.cursor) return keyword

        const { query, cursor: _cursor, limit: _limit, ...filters } = criteria
        let semantic: PetMatch[]
        try {
            semantic = await this.semantic.execute(query, filters)
        } catch (error) {
            this.reportError(error, 'semantic-search')
            return keyword
        }

        const seen = new Set(keyword.items.map(pet => pet.id))
        // Ranked rather than paginated: the first keyword page plus every semantic match (bounded by its limit).
        return {
            items: [...keyword.items, ...semantic.map(m => m.pet).filter(pet => !seen.has(pet.id))],
            nextCursor: null
        }
    }
}

function matchesFilters(pet: Pet, filters: SemanticFilters): boolean {
    const p = pet.toSnapshot()
    return (
        (!filters.reportType || p.reportType === filters.reportType) &&
        (!filters.species || p.species === filters.species) &&
        (!filters.resolution || p.resolution === filters.resolution)
    )
}
