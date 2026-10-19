import type { Page } from '../../../shared/application/ports'
import type { Pet } from '../domain/Pet'
import type { ReportType, Resolution, Species } from '../domain/values'

export interface PetSearchCriteria {
    reportType?: ReportType
    species?: Species
    resolution?: Resolution
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
