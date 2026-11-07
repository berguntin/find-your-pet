import type { Actor } from '../../../shared/domain/actor'
import { ConflictError, ForbiddenError, ValidationError } from '../../../shared/domain/errors'
import type { SightingEvent } from './events'
import type { ModerationScores } from './moderation'
import { SIGHTING_LIMITS, SIGHTING_VERIFICATION, type ModerationStatus, type SightingVerifiedBy } from './values'

export interface SightingValidation {
    userId: string
    weight: number
    createdAt: Date
}

export interface SightingProps {
    id: string
    petId: string
    /** Null once the author deletes their account. */
    authorId: string | null
    description: string
    /** Approximate area (street, neighbourhood), never an exact address. */
    area: string
    seenAt: Date
    images: string[]
    moderationStatus: ModerationStatus
    moderationScores: ModerationScores | null
    moderatedAt: Date | null
    verifiedAt: Date | null
    verifiedBy: SightingVerifiedBy | null
    validations: SightingValidation[]
    /** Optimistic locking version, managed by the repository. */
    version: number
    createdAt: Date
}

export interface ReportSightingData {
    description: string
    area: string
    seenAt: Date
    images?: string[]
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
/** Small allowance for clocks of phones running a bit ahead. */
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000

/**
 * "I saw this pet here": an update on a pet's notice. Other signed-in people can validate it; it becomes
 * verified at SIGHTING_VERIFICATION.threshold points (1 per person, 3 from the pet's owner). Verified means
 * other people back it up, not that it is certainly the pet. Once verified it stays verified.
 */
export class Sighting {
    private events: SightingEvent[] = []

    private constructor(private props: SightingProps) {}

    static report(
        data: ReportSightingData,
        context: { id: string; petId: string; authorId: string; now: Date }
    ): Sighting {
        const description = data.description.trim()
        const area = data.area.trim()
        const images = data.images ?? []
        if (
            description.length < SIGHTING_LIMITS.descriptionMinLength ||
            description.length > SIGHTING_LIMITS.descriptionMaxLength
        ) {
            throw new ValidationError('Invalid description length', { field: 'description' })
        }
        if (area.length < SIGHTING_LIMITS.areaMinLength || area.length > SIGHTING_LIMITS.areaMaxLength) {
            throw new ValidationError('Invalid area length', { field: 'area' })
        }
        if (images.length > SIGHTING_LIMITS.maxImages) {
            throw new ValidationError('Too many images', { field: 'images' })
        }
        const now = context.now.getTime()
        const seenAt = data.seenAt.getTime()
        if (Number.isNaN(seenAt) || seenAt > now + FUTURE_TOLERANCE_MS) {
            throw new ValidationError('The sighting cannot be in the future', { field: 'seenAt' })
        }
        if (seenAt < now - SIGHTING_LIMITS.maxAgeDays * ONE_DAY_MS) {
            throw new ValidationError('The sighting is too old', { field: 'seenAt' })
        }

        return new Sighting({
            id: context.id,
            petId: context.petId,
            authorId: context.authorId,
            description,
            area,
            seenAt: data.seenAt,
            images: [...images],
            moderationStatus: 'pending_review',
            moderationScores: null,
            moderatedAt: null,
            verifiedAt: null,
            verifiedBy: null,
            validations: [],
            version: 0,
            createdAt: context.now
        })
    }

    static restore(props: SightingProps): Sighting {
        return new Sighting({
            ...props,
            images: [...props.images],
            validations: props.validations.map(v => ({ ...v }))
        })
    }

    get id(): string {
        return this.props.id
    }

    get petId(): string {
        return this.props.petId
    }

    get isPublic(): boolean {
        return this.props.moderationStatus === 'approved'
    }

    get isVerified(): boolean {
        return this.props.verifiedAt !== null
    }

    get points(): number {
        return this.props.validations.reduce((sum, validation) => sum + validation.weight, 0)
    }

    isAuthor(userId: string | null): boolean {
        return userId !== null && this.props.authorId === userId
    }

    hasValidated(userId: string | null): boolean {
        return userId !== null && this.props.validations.some(validation => validation.userId === userId)
    }

    /** Whether `userId` may validate it now: published, not theirs, not validated by them yet. */
    canBeValidatedBy(userId: string | null): boolean {
        return userId !== null && this.isPublic && !this.isAuthor(userId) && !this.hasValidated(userId)
    }

    /** `petOwnerId` is the owner of the sighting's pet: their validation weighs enough to verify it alone. */
    validate(userId: string, petOwnerId: string | null, now: Date): void {
        if (!this.isPublic) throw new ConflictError('The sighting is not published')
        if (this.isAuthor(userId)) throw new ForbiddenError('You cannot validate your own sighting')
        if (this.hasValidated(userId)) throw new ConflictError('You already validated this sighting')

        const byOwner = petOwnerId !== null && userId === petOwnerId
        const weight = byOwner ? SIGHTING_VERIFICATION.ownerWeight : SIGHTING_VERIFICATION.userWeight
        this.props.validations.push({ userId, weight, createdAt: now })

        if (!this.isVerified && this.points >= SIGHTING_VERIFICATION.threshold) {
            this.props.verifiedAt = now
            this.props.verifiedBy = byOwner ? 'owner' : 'community'
            this.events.push({
                type: 'sighting.verified',
                occurredAt: now,
                payload: { sightingId: this.props.id, petId: this.props.petId }
            })
        }
    }

    applyAutomaticModeration(status: ModerationStatus, scores: ModerationScores | null, now: Date): void {
        this.props.moderationScores = scores
        this.props.moderatedAt = now
        this.setStatus(status, now)
    }

    approve(actor: Actor, now: Date): void {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        this.props.moderatedAt = now
        this.setStatus('approved', now)
    }

    unpublish(actor: Actor, now: Date): void {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        this.props.moderatedAt = now
        this.setStatus('pending_review', now)
    }

    /** The pet's family (or an admin) sends a published sighting back to review, e.g. abuse on their notice. */
    hideForReview(now: Date): void {
        if (!this.isPublic) throw new ConflictError('The sighting is not published')
        this.props.moderatedAt = now
        this.setStatus('pending_review', now)
    }

    canBeDeletedBy(actor: Actor): boolean {
        if (actor.kind === 'admin') return true
        return actor.kind === 'user' && this.isAuthor(actor.userId)
    }

    pullEvents(): SightingEvent[] {
        const events = this.events
        this.events = []
        return events
    }

    toSnapshot(): SightingProps {
        return {
            ...this.props,
            images: [...this.props.images],
            validations: this.props.validations.map(v => ({ ...v }))
        }
    }

    private setStatus(status: ModerationStatus, now: Date): void {
        const wasPublic = this.isPublic
        this.props.moderationStatus = status
        if (!wasPublic && this.isPublic) {
            this.events.push({
                type: 'sighting.published',
                occurredAt: now,
                payload: { sightingId: this.props.id, petId: this.props.petId }
            })
        }
    }
}
