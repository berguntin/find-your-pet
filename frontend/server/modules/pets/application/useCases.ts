import type { Actor } from '../../../shared/domain/actor'
import type { Clock, IdGenerator, Page } from '../../../shared/application/ports'
import { ContentRejectedError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/domain/errors'
import { decideModeration, type ModerationScores, type ModerationThresholds } from '../domain/moderation'
import { Pet, type ReportPetData } from '../domain/Pet'
import type {
    ContentModerator,
    ImageStorage,
    PetDescriber,
    PetDescription,
    PetRepository,
    PetSearchCriteria,
    UploadAuthorization
} from './ports'

/** Images sent to the moderator are scaled down to this size to save tokens. */
const MODERATION_IMAGE_SIZE = 768

/** Receives errors the use cases recover from, so they are still logged. */
export type ErrorReporter = (error: unknown, context: string) => void

export class ReportPet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly moderator: ContentModerator,
        private readonly thresholds: ModerationThresholds,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(data: ReportPetData, actor: Actor): Promise<Pet> {
        const foreign = data.images.filter(url => !this.images.isManagedUrl(url))
        if (foreign.length > 0) {
            throw new ValidationError('Images must be uploaded through the app', { field: 'images' })
        }

        const pet = Pet.report(data, {
            id: this.ids.next(),
            now: this.clock.now(),
            ownerId: actor.kind === 'user' ? actor.userId : null
        })

        const scores = await this.moderate(pet)
        const decision = decideModeration(scores, this.thresholds)
        if (decision === 'rejected') {
            // Rejected reports are not stored, and neither are their images.
            await this.images.delete(pet.toSnapshot().images).catch(error => this.reportError(error, 'delete-images'))
            throw new ContentRejectedError()
        }

        pet.applyAutomaticModeration(decision, scores, this.clock.now())
        await this.pets.save(pet)
        return pet
    }

    private async moderate(pet: Pet): Promise<ModerationScores | null> {
        const { reportType, species, name, description, location, contact, images } = pet.toSnapshot()
        try {
            return await this.moderator.review({
                reportType,
                species,
                name,
                description,
                location,
                contact,
                images: images.map(url => this.images.previewUrl(url, MODERATION_IMAGE_SIZE))
            })
        } catch (error) {
            this.reportError(error, 'moderation')
            return null
        }
    }
}

/** Admin listing by moderation status, pending review by default. */
export class ListPetsForModeration {
    constructor(private readonly pets: PetRepository) {}

    async execute(criteria: PetSearchCriteria, actor: Actor): Promise<Page<Pet>> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        return this.pets.search({ ...criteria, moderationStatus: criteria.moderationStatus ?? 'pending_review' })
    }
}

/** Pets awaiting review are only visible to whoever can manage them. */
export class GetPet {
    constructor(private readonly pets: PetRepository) {}

    async execute(id: string, actor: Actor): Promise<Pet> {
        const pet = await findPet(this.pets, id)
        if (!pet.isPublic && !pet.canBeManagedBy(actor)) throw new NotFoundError('Pet not found')
        return pet
    }
}

export class MarkPetAsReunited {
    constructor(private readonly pets: PetRepository, private readonly clock: Clock) {}

    async execute(id: string, actor: Actor): Promise<Pet> {
        const pet = await findPet(this.pets, id)
        pet.markAsReunited(actor, this.clock.now())
        await this.pets.save(pet)
        return pet
    }
}

export class DeletePet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly clock: Clock,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(id: string, actor: Actor): Promise<void> {
        const pet = await findPet(this.pets, id)
        pet.assertCanBeManagedBy(actor)
        await deleteWithImages(pet, this.pets, this.images, this.clock, this.reportError)
    }
}

/** An admin publishes a report left for review, or rejects it (which deletes it and its images). */
export class ModeratePet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly clock: Clock,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(id: string, decision: 'approved' | 'rejected', actor: Actor): Promise<Pet | null> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        const pet = await findPet(this.pets, id)

        if (decision === 'rejected') {
            await deleteWithImages(pet, this.pets, this.images, this.clock, this.reportError)
            return null
        }

        pet.approve(actor, this.clock.now())
        await this.pets.save(pet)
        return pet
    }
}

/**
 * Deletes uploads that no pet references: abandoned forms, or deletions whose image cleanup failed.
 * Only images older than `minAge` are considered, so forms being filled in are never affected.
 */
export class CleanUpOrphanImages {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly clock: Clock
    ) {}

    async execute(options: { minAgeHours?: number; maxDeletions?: number } = {}): Promise<{ deleted: number }> {
        const { minAgeHours = 24, maxDeletions = 200 } = options
        const cutoff = new Date(this.clock.now().getTime() - minAgeHours * 60 * 60 * 1000)

        const uploaded = await this.images.listUploadedBefore(cutoff)
        const referenced = new Set((await this.pets.listAllImageUrls()).map(url => this.images.imageKey(url)))
        const orphans = uploaded
            .filter(url => {
                const key = this.images.imageKey(url)
                return key !== null && !referenced.has(key)
            })
            // A cap per run limits the damage of any bug in how images are matched.
            .slice(0, maxDeletions)

        await this.images.delete(orphans)
        return { deleted: orphans.length }
    }
}

export class DescribePetFromImage {
    constructor(private readonly describer: PetDescriber) {}

    execute(imageDataUrl: string): Promise<PetDescription | null> {
        return this.describer.describe(imageDataUrl)
    }
}

export class AuthorizeImageUpload {
    constructor(private readonly images: ImageStorage) {}

    execute(): UploadAuthorization {
        return this.images.authorizeUpload()
    }
}

async function findPet(pets: PetRepository, id: string): Promise<Pet> {
    const pet = await pets.findById(id)
    if (!pet) throw new NotFoundError('Pet not found')
    return pet
}

async function deleteWithImages(
    pet: Pet,
    pets: PetRepository,
    images: ImageStorage,
    clock: Clock,
    reportError: ErrorReporter
): Promise<void> {
    pet.recordRemoval(clock.now())
    await pets.delete(pet)
    // The pet is already gone; leftover images are removed later by the orphan cleanup.
    await images.delete(pet.toSnapshot().images).catch(error => reportError(error, 'delete-images'))
}
