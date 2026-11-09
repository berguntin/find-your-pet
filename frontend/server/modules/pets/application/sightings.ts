import { actorUserId, type Actor } from '../../../shared/domain/actor'
import type { Clock, IdGenerator } from '../../../shared/application/ports'
import {
    ConflictError,
    ContentRejectedError,
    ForbiddenError,
    NotFoundError,
    ValidationError
} from '../../../shared/domain/errors'
import {
    decideModeration,
    type ModerationDecision,
    type ModerationScores,
    type ModerationThresholds
} from '../domain/moderation'
import type { Pet } from '../domain/Pet'
import { looksLikeContactOrPayment } from '../domain/contactDetails'
import { Sighting, type ReportSightingData } from '../domain/Sighting'
import type { ModerationStatus } from '../domain/values'
import {
    StaleSightingError,
    type AuthorDirectory,
    type ContentModerator,
    type ImageStorage,
    type ModerationLog,
    type PetRepository,
    type SightingRepository
} from './ports'
import type { SharedImageGuard } from './sharedImages'
import type { ErrorReporter } from './useCases'

/** Images sent to the moderator are scaled down to this size to save tokens. */
const MODERATION_IMAGE_SIZE = 768
const MAX_LOGGED_ERROR_LENGTH = 500
/** Concurrent validations of one sighting are retried this many times before giving up (then 409). */
const MAX_SAVE_ATTEMPTS = 3
/** Most recent sightings shown on a pet's page. */
const MAX_LISTED_SIGHTINGS = 50

/** A sighting as one viewer sees it. */
export interface SightingView {
    sighting: Sighting
    /** First name of the author; null once they deleted their account. */
    authorName: string | null
    viewer: { isAuthor: boolean; hasValidated: boolean; canValidate: boolean; canHide: boolean }
}

/** A signed-in person reports seeing a pet with an open, published notice. Moderated like a notice. */
export class ReportSighting {
    constructor(
        private readonly pets: PetRepository,
        private readonly sightings: SightingRepository,
        private readonly images: SharedImageGuard,
        private readonly moderator: ContentModerator,
        private readonly thresholds: ModerationThresholds,
        private readonly log: ModerationLog,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(petId: string, data: ReportSightingData, actor: Actor): Promise<Sighting> {
        const authorId = actorUserId(actor)
        if (!authorId) throw new ForbiddenError('Sign in to report a sighting')
        const pet = await this.pets.findById(petId)
        if (!pet?.isPublic) throw new NotFoundError('Pet not found')
        if (pet.isReunited) throw new ConflictError('The pet is already reunited with its family')
        const images = data.images ?? []
        if (images.some(url => !this.images.isManagedUrl(url))) {
            throw new ValidationError('Images must be uploaded through the app', { field: 'images' })
        }
        // A sighting brings new photos: reusing a notice's own photo would make a fake sighting look real.
        if ((await this.images.alreadyUsed(images)).length > 0) {
            throw new ValidationError('Images must be new uploads', { field: 'images' })
        }

        const sighting = Sighting.report(
            { ...data, images },
            { id: this.ids.next(), petId, authorId, now: this.clock.now() }
        )

        const startedAt = this.clock.now()
        const { scores, error } = await this.moderate(pet, sighting)
        const latencyMs = this.clock.now().getTime() - startedAt.getTime()
        const automatic = decideModeration(scores, this.thresholds, { hasImages: images.length > 0 })
        // Contact details or money talk are a scam pattern: a person always looks at those first.
        const { description, area } = sighting.toSnapshot()
        const decision =
            automatic === 'approved' && looksLikeContactOrPayment(description, area) ? 'pending_review' : automatic
        // Logged with the sighting's id even when rejected (it is never stored), to tell sightings apart.
        const logDecision = () => this.logDecision(pet, sighting, decision, scores, error, latencyMs)

        if (decision === 'rejected') {
            await logDecision()
            await this.images.delete(images).catch(error => this.reportError(error, 'delete-images'))
            throw new ContentRejectedError('The sighting does not look like a sighting of this pet')
        }

        sighting.applyAutomaticModeration(decision, scores, this.clock.now())
        await this.sightings.add(sighting)
        await logDecision()
        return sighting
    }

    private async moderate(
        pet: Pet,
        sighting: Sighting
    ): Promise<{ scores: ModerationScores | null; error: string | null }> {
        const { reportType, species } = pet.toSnapshot()
        const { description, area, images } = sighting.toSnapshot()
        try {
            const scores = await this.moderator.review({
                kind: 'sighting',
                reportType,
                species,
                name: null,
                description,
                location: area,
                contact: '',
                images: images.map(url => this.images.previewUrl(url, MODERATION_IMAGE_SIZE))
            })
            return { scores, error: null }
        } catch (error) {
            this.reportError(error, 'moderation')
            const message = error instanceof Error ? error.message : String(error)
            return { scores: null, error: message.slice(0, MAX_LOGGED_ERROR_LENGTH) }
        }
    }

    private async logDecision(
        pet: Pet,
        sighting: Sighting,
        decision: ModerationDecision,
        scores: ModerationScores | null,
        error: string | null,
        latencyMs: number
    ): Promise<void> {
        const { reportType, species } = pet.toSnapshot()
        const { description, area } = sighting.toSnapshot()
        await this.log
            .record({
                id: this.ids.next(),
                petId: pet.id,
                sightingId: sighting.id,
                source: 'automatic',
                decision,
                scores,
                model: this.moderator.model,
                error,
                latencyMs,
                submission: { reportType, species, name: null, description, location: area },
                decidedAt: this.clock.now()
            })
            .catch(error => this.reportError(error, 'moderation-log'))
    }
}

export interface PetSightings {
    items: SightingView[]
    /** The viewer reported the pet: their validation verifies a sighting on its own. */
    viewerIsPetOwner: boolean
}

/** The sightings of a pet everyone can see, plus the viewer's own ones still waiting for review. */
export class ListSightings {
    constructor(
        private readonly pets: PetRepository,
        private readonly sightings: SightingRepository,
        private readonly authors: AuthorDirectory
    ) {}

    async execute(petId: string, actor: Actor): Promise<PetSightings> {
        const pet = await this.pets.findById(petId)
        if (!pet || (!pet.isPublic && !pet.canBeManagedBy(actor))) throw new NotFoundError('Pet not found')

        const viewerId = actorUserId(actor)
        const visible = await this.sightings.listByPet(petId, {
            includeAuthorId: viewerId,
            includeAll: actor.kind === 'admin',
            limit: MAX_LISTED_SIGHTINGS
        })
        const authorIds = visible.flatMap(sighting => sighting.toSnapshot().authorId ?? [])
        const names = authorIds.length > 0 ? await this.authors.displayNames([...new Set(authorIds)]) : new Map()
        const open = !pet.isReunited
        const ownerId = pet.toSnapshot().ownerId
        const viewerIsPetOwner = viewerId !== null && viewerId === ownerId

        const items = visible.map(sighting => {
            const { authorId } = sighting.toSnapshot()
            return {
                sighting,
                authorName: authorId ? names.get(authorId) ?? null : null,
                viewer: {
                    isAuthor: sighting.isAuthor(viewerId),
                    hasValidated: sighting.hasValidated(viewerId),
                    canValidate: open && sighting.canBeValidatedBy(viewerId),
                    canHide: viewerIsPetOwner && sighting.isPublic
                }
            }
        })
        return { items, viewerIsPetOwner }
    }
}

/** "I saw it too" / "it is my pet": adds a validation, which may verify the sighting. */
export class ValidateSighting {
    constructor(
        private readonly pets: PetRepository,
        private readonly sightings: SightingRepository,
        private readonly clock: Clock
    ) {}

    async execute(sightingId: string, actor: Actor): Promise<Sighting> {
        const userId = actorUserId(actor)
        if (!userId) throw new ForbiddenError('Sign in to validate a sighting')

        for (let attempt = 1; ; attempt++) {
            const sighting = await this.sightings.findById(sightingId)
            if (!sighting?.isPublic) throw new NotFoundError('Sighting not found')
            const pet = await this.pets.findById(sighting.petId)
            if (!pet?.isPublic) throw new NotFoundError('Sighting not found')
            if (pet.isReunited) throw new ConflictError('The pet is already reunited with its family')

            sighting.validate(userId, pet.toSnapshot().ownerId, this.clock.now())
            try {
                await this.sightings.save(sighting)
                return sighting
            } catch (error) {
                // Someone validated at the same time: reload and apply ours on top of theirs.
                if (!(error instanceof StaleSightingError) || attempt >= MAX_SAVE_ATTEMPTS) throw error
            }
        }
    }
}

/** The pet's owner hides a published sighting from their notice until an admin reviews it. */
export class HideSighting {
    constructor(
        private readonly pets: PetRepository,
        private readonly sightings: SightingRepository,
        private readonly clock: Clock
    ) {}

    async execute(sightingId: string, actor: Actor): Promise<Sighting> {
        const sighting = await this.sightings.findById(sightingId)
        if (!sighting?.isPublic) throw new NotFoundError('Sighting not found')
        const pet = await this.pets.findById(sighting.petId)
        const ownerId = pet?.toSnapshot().ownerId ?? null
        const isOwner = ownerId !== null && actorUserId(actor) === ownerId
        if (!isOwner && actor.kind !== 'admin') throw new ForbiddenError()

        sighting.hideForReview(this.clock.now())
        await this.sightings.save(sighting)
        return sighting
    }
}

/** The author (or an admin) removes a sighting and its photos. */
export class DeleteSighting {
    constructor(
        private readonly sightings: SightingRepository,
        private readonly images: ImageStorage,
        private readonly log: ModerationLog,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(sightingId: string, actor: Actor): Promise<void> {
        const sighting = await this.sightings.findById(sightingId)
        if (!sighting || (!sighting.isPublic && !sighting.canBeDeletedBy(actor))) {
            throw new NotFoundError('Sighting not found')
        }
        if (!sighting.canBeDeletedBy(actor)) throw new ForbiddenError()
        await deleteSightingWithImages(sighting, this.sightings, this.images, this.reportError)
        // What the author wrote should not outlive their deletion, not even in the moderation log.
        await this.log.forgetSubmission(sighting.id).catch(error => this.reportError(error, 'moderation-log'))
    }
}

/** Admin listing of sightings by moderation status, pending review by default. */
export class ListSightingsForModeration {
    constructor(private readonly sightings: SightingRepository) {}

    async execute(status: ModerationStatus, actor: Actor, limit = 100): Promise<Sighting[]> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        return this.sightings.listByStatus(status, limit)
    }
}

/** An admin publishes, hides or rejects (deletes) a sighting. Logged with the other decisions. */
export class ModerateSighting {
    constructor(
        private readonly sightings: SightingRepository,
        private readonly images: ImageStorage,
        private readonly log: ModerationLog,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
        private readonly reportError: ErrorReporter
    ) {}

    async execute(sightingId: string, decision: ModerationDecision, actor: Actor): Promise<Sighting | null> {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        const sighting = await this.sightings.findById(sightingId)
        if (!sighting) throw new NotFoundError('Sighting not found')

        if (decision === 'rejected') {
            await deleteSightingWithImages(sighting, this.sightings, this.images, this.reportError)
        } else {
            if (decision === 'approved') sighting.approve(actor, this.clock.now())
            else sighting.unpublish(actor, this.clock.now())
            await this.sightings.save(sighting)
        }

        await this.log
            .record({
                id: this.ids.next(),
                petId: sighting.petId,
                sightingId: sighting.id,
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
        return decision === 'rejected' ? null : sighting
    }
}

async function deleteSightingWithImages(
    sighting: Sighting,
    sightings: SightingRepository,
    images: ImageStorage,
    reportError: ErrorReporter
): Promise<void> {
    await sightings.delete(sighting.id)
    // Leftover images are removed later by the orphan cleanup.
    await images.delete(sighting.toSnapshot().images).catch(error => reportError(error, 'delete-images'))
}
