import type { Page } from '../../../shared/application/ports'
import type { ModerationDecision, ModerationRecord, ModerationScores, ModerationSource } from '../domain/moderation'
import type { Pet } from '../domain/Pet'
import type { ModerationStatus, ReportType, Resolution, Species } from '../domain/values'

export interface PetSearchCriteria {
    reportType?: ReportType
    species?: Species
    resolution?: Resolution
    /** Omitted means any status: callers decide what each audience may see. */
    moderationStatus?: ModerationStatus
    /** Free text matched against name, description and location. */
    query?: string
    /** Opaque cursor returned by a previous search. */
    cursor?: string
    limit: number
}

export interface PetRepository {
    save(pet: Pet): Promise<void>
    findById(id: string): Promise<Pet | null>
    findByIds(ids: string[]): Promise<Pet[]>
    delete(id: string): Promise<void>
    search(criteria: PetSearchCriteria): Promise<Page<Pet>>
    /** Every image URL used by any pet, to find orphan uploads. */
    listAllImageUrls(): Promise<string[]>
    /** Pets reported and reunited since `since`, per calendar day in `timeZone` (YYYY-MM-DD). */
    countDailyActivity(since: Date, timeZone: string): Promise<DailyPetActivity[]>
    /** Every stored pet, counted by report type, resolution and moderation status. */
    countByState(): Promise<PetStateCount[]>
}

export interface DailyPetActivity {
    day: string
    kind: 'reported' | 'reunited'
    reportType: ReportType
    species: Species
    count: number
}

export interface PetStateCount {
    reportType: ReportType
    resolution: Resolution
    moderationStatus: ModerationStatus
    count: number
}

export interface UploadAuthorization {
    uploadUrl: string
    fields: Record<string, string>
}

export interface ImageStorage {
    /** True when the URL points to an image uploaded to our own storage. */
    isManagedUrl(url: string): boolean
    /** Signed parameters the browser uses to upload an image directly to storage. */
    authorizeUpload(): UploadAuthorization
    /** A smaller version of a managed image, e.g. to send to AI models. */
    previewUrl(url: string, maxSize: number): string
    /** Removes managed images. Unknown or foreign URLs are ignored. */
    delete(urls: string[]): Promise<void>
    /** URLs of managed images uploaded before the given date. */
    listUploadedBefore(date: Date): Promise<string[]>
    /** Identifies an image regardless of transformations or format in its URL; null for foreign URLs. */
    imageKey(url: string): string | null
}

export interface PetDescription {
    species: Species | null
    description: string | null
    name: string | null
    location: string | null
    contact: string | null
    eventDate: string | null
}

export interface PetDescriber {
    /** Returns null when the image does not show a pet. */
    describe(imageDataUrl: string): Promise<PetDescription | null>
}

export interface ModerationSubmission {
    reportType: ReportType
    species: Species
    name: string | null
    description: string
    location: string
    contact: string
    /** Publicly reachable image URLs. */
    images: string[]
}

export interface ContentModerator {
    /** Model behind the scores, for the moderation log; null when no model is configured. */
    readonly model: string | null
    /** Throws when the moderator cannot be reached; the caller then sends the report to manual review. */
    review(submission: ModerationSubmission): Promise<ModerationScores>
}

/** Every moderation decision, so the admin can see how the automatic moderator behaves. */
export interface ModerationLog {
    record(record: ModerationRecord): Promise<void>
    /** Decisions since `since`, counted per calendar day in `timeZone`, source, decision and failure. */
    countByDay(since: Date, timeZone: string): Promise<ModerationDayCount[]>
    /** Latest decisions, newest first. */
    recent(limit: number): Promise<ModerationRecord[]>
}

export interface ModerationDayCount {
    day: string
    source: ModerationSource
    decision: ModerationDecision
    /** True when the moderator failed and the decision is the fallback (review). */
    failed: boolean
    count: number
    /** Sum and count of the measured latencies, to average them across days. */
    latencyMsTotal: number
    latencyCount: number
}

export type EmbeddingInput =
    | { kind: 'url'; url: string }
    | { kind: 'bytes'; mimeType: string; data: Uint8Array }
    | { kind: 'text'; text: string }

/** Multimodal embeddings: text and images share one vector space, so text can find photos. */
export interface Embedder {
    /** Identifies the vectors' space: vectors from different models are never compared. */
    readonly model: string
    /** False when the provider is not configured; callers skip semantic features instead of failing. */
    readonly available: boolean
    /** One vector per input, in the same order. */
    embed(inputs: EmbeddingInput[]): Promise<number[][]>
}

export interface IndexedImage {
    imageUrl: string
    vector: number[]
}

export interface PetEmbeddings {
    images: IndexedImage[]
    /** Embedding of the report text (species, description, name, location). */
    text: number[]
}

export type EmbeddingSource = 'image' | 'text'

export interface SimilarPet {
    petId: string
    /** Cosine similarity of the pet's closest vector of the requested source. */
    similarity: number
}

export interface PetEmbeddingIndex {
    /** Replaces every vector of the pet for the model. */
    replace(petId: string, model: string, embeddings: PetEmbeddings): Promise<void>
    remove(petId: string): Promise<void>
    /** Pets whose vectors of `source` are closest, best vector per pet, most similar first. */
    findSimilar(vector: number[], model: string, limit: number, source: EmbeddingSource): Promise<SimilarPet[]>
    /** The given pets that already have vectors for the model. */
    findIndexed(petIds: string[], model: string): Promise<Set<string>>
}
