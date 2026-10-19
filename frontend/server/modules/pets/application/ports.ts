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
    delete(id: string): Promise<void>
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
