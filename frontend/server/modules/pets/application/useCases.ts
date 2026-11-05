import type { Actor } from '../../../shared/domain/actor'
import type { Clock, IdGenerator, Page } from '../../../shared/application/ports'
import { ContentRejectedError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/domain/errors'
import {
    decideModeration,
    type ModerationDecision,
    type ModerationScores,
    type ModerationThresholds
} from '../domain/moderation'
import { Pet, type ReportPetData } from '../domain/Pet'
import type { ModerationStatus, Resolution } from '../domain/values'
import type {
    ContentModerator,
    ImageStorage,
    ModerationLog,
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

/** Longest moderator error message kept in the moderation log. */
const MAX_LOGGED_ERROR_LENGTH = 500

export class ReportPet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly moderator: ContentModerator,
        private readonly thresholds: ModerationThresholds,
        private readonly log: ModerationLog,
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

        const startedAt = this.clock.now()
        const { scores, error } = await this.moderate(pet)
        const latencyMs = this.clock.now().getTime() - startedAt.getTime()
        const decision = decideModeration(scores, this.thresholds)
        const logDecision = (petId: string | null) => this.logDecision(pet, petId, decision, scores, error, latencyMs)

        if (decision === 'rejected') {
            await logDecision(null)
            // Rejected reports are not stored, and neither are their images.
            await this.images.delete(pet.toSnapshot().images).catch(error => this.reportError(error, 'delete-images'))
            throw new ContentRejectedError()
        }

        pet.applyAutomaticModeration(decision, scores, this.clock.now())
        await this.pets.save(pet)
        await logDecision(pet.id)
        return pet
    }

    private async moderate(pet: Pet): Promise<{ scores: ModerationScores | null; error: string | null }> {
        const { reportType, species, name, description, location, contact, images } = pet.toSnapshot()
        try {
            const scores = await this.moderator.review({
                reportType,
                species,
                name,
                description,
                location,
                contact,
                images: images.map(url => this.images.previewUrl(url, MODERATION_IMAGE_SIZE))
            })
            return { scores, error: null }
        } catch (error) {
            this.reportError(error, 'moderation')
            const message = error instanceof Error ? error.message : String(error)
            return { scores: null, error: message.slice(0, MAX_LOGGED_ERROR_LENGTH) }
        }
    }

    /** The log only feeds statistics: failing to write it never fails the report. */
    private async logDecision(
        pet: Pet,
        petId: string | null,
        decision: ModerationDecision,
        scores: ModerationScores | null,
        error: string | null,
        latencyMs: number
    ): Promise<void> {
        const { reportType, species, name, description, location } = pet.toSnapshot()
        await this.log
            .record({
                id: this.ids.next(),
                petId,
                source: 'automatic',
                decision,
                scores,
                model: this.moderator.model,
                error,
                latencyMs,
                submission: { reportType, species, name, description, location },
                decidedAt: this.clock.now()
            })
            .catch(error => this.reportError(error, 'moderation-log'))
    }
}

export type AdminPetCriteria = Omit<PetSearchCriteria, 'moderationStatus'> & {
    /** `all` lists every pet; omitted means pending review. */
    moderationStatus?: ModerationStatus | 'all'
}

/** Admin listing by moderation status, pending review by default. */
export class ListPetsForModeration {
    constructor(private readonly pets: PetRepository) {}

    async execute(
        { moderationStatus = 'pending_review', ...criteria }: AdminPetCriteria,
        actor: Actor
    ): Promise<Page<Pet>> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        return this.pets.search({
            ...criteria,
            moderationStatus: moderationStatus === 'all' ? undefined : moderationStatus
        })
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

/** Details to correct, and optionally the case's resolution. Omitted fields keep their value. */
export type PetUpdate = Partial<ReportPetData> & { resolution?: Resolution }

/** Corrects a report: any reported detail, its photos, and whether it is still open. */
export class UpdatePet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly clock: Clock,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(id: string, { resolution, ...changes }: PetUpdate, actor: Actor): Promise<Pet> {
        const pet = await findPet(this.pets, id)
        const before = pet.toSnapshot().images
        const added = (changes.images ?? []).filter(url => !before.includes(url))
        if (added.some(url => !this.images.isManagedUrl(url))) {
            throw new ValidationError('Images must be uploaded through the app', { field: 'images' })
        }

        const now = this.clock.now()
        pet.edit(changes, actor, now)
        if (resolution === 'reunited' && !pet.isReunited) pet.markAsReunited(actor, now)
        if (resolution === 'open' && pet.isReunited) pet.reopen(actor)
        await this.pets.save(pet)

        const kept = pet.toSnapshot().images
        const removed = before.filter(url => !kept.includes(url))
        await this.images.delete(removed).catch(error => this.reportError(error, 'delete-images'))
        return pet
    }
}

export class DeletePet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(id: string, actor: Actor): Promise<void> {
        const pet = await findPet(this.pets, id)
        pet.assertCanBeManagedBy(actor)
        await deleteWithImages(pet, this.pets, this.images, this.reportError)
    }
}

/**
 * An admin publishes a report, hides a published one back to review, or rejects it (which deletes it
 * and its images). Every decision is logged next to the automatic ones.
 */
export class ModeratePet {
    constructor(
        private readonly pets: PetRepository,
        private readonly images: ImageStorage,
        private readonly log: ModerationLog,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(id: string, decision: ModerationDecision, actor: Actor): Promise<Pet | null> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        const pet = await findPet(this.pets, id)

        if (decision === 'rejected') {
            await deleteWithImages(pet, this.pets, this.images, this.reportError)
        } else {
            if (decision === 'approved') pet.approve(actor, this.clock.now())
            else pet.unpublish(actor, this.clock.now())
            await this.pets.save(pet)
        }

        await this.log
            .record({
                id: this.ids.next(),
                petId: pet.id,
                source: 'admin',
                decision,
                scores: null,
                model: null,
                error: null,
                latencyMs: null,
                submission: null,
                decidedAt: this.clock.now()
            })
            .catch(error => this.reportError(error, 'moderation-log'))
        return decision === 'rejected' ? null : pet
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
    reportError: ErrorReporter
): Promise<void> {
    await pets.delete(pet.id)
    // The pet is already gone; leftover images are removed later by the orphan cleanup.
    await images.delete(pet.toSnapshot().images).catch(error => reportError(error, 'delete-images'))
}
