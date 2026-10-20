import type { Page } from '../../../shared/application/ports'
import type { ModerationScores } from '../domain/moderation'
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
    /** Deletes the pet and stores its recorded events (e.g. `pet.removed`) atomically. */
    delete(pet: Pet): Promise<void>
    search(criteria: PetSearchCriteria): Promise<Page<Pet>>
    /** Every image URL used by any pet, to find orphan uploads. */
    listAllImageUrls(): Promise<string[]>
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
    /** Throws when the moderator cannot be reached; the caller then sends the report to manual review. */
    review(submission: ModerationSubmission): Promise<ModerationScores>
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

export interface SocialPost {
    message: string
    /** Publicly reachable image URLs, in display order. */
    imageUrls: string[]
}

/** A page or account of ours on a social network where pets are announced. */
export interface SocialPublisher {
    /** Identifies the network in stored posts, e.g. 'facebook'. */
    readonly network: string
    /** Returns the post's id on the network. */
    publish(post: SocialPost): Promise<string>
    updateMessage(postId: string, message: string): Promise<void>
    /** Posts already deleted on the network count as removed. */
    remove(postId: string): Promise<void>
}

/** Which post announces each pet on each network, so events are handled once and posts can be updated. */
export interface SocialPostRepository {
    find(petId: string, network: string): Promise<string | null>
    save(petId: string, network: string, postId: string, publishedAt: Date): Promise<void>
    remove(petId: string, network: string): Promise<void>
}
