import type { Actor } from '../../../shared/domain/actor'
import { ConflictError, ForbiddenError, ValidationError } from '../../../shared/domain/errors'
import type { PetEvent } from './events'
import type { ModerationScores } from './moderation'
import {
    PET_LIMITS,
    REPORT_TYPES,
    SPECIES,
    type ModerationStatus,
    type ReportType,
    type Resolution,
    type ResolvedBy,
    type Species
} from './values'

export interface PetProps {
    id: string
    reportType: ReportType
    species: Species
    name: string | null
    description: string
    location: string
    contact: string
    images: string[]
    /** Only meaningful for found pets: lost pets are assumed alive. */
    alive: boolean
    /** Day the pet was lost or found, as YYYY-MM-DD. */
    eventDate: string
    resolution: Resolution
    resolvedBy: ResolvedBy | null
    resolvedAt: Date | null
    ownerId: string | null
    /** New reports wait for moderation; only approved pets are public. */
    moderationStatus: ModerationStatus
    moderationScores: ModerationScores | null
    moderatedAt: Date | null
    createdAt: Date
}

export interface ReportPetData {
    reportType: ReportType
    species: Species
    name?: string | null
    description: string
    location: string
    contact: string
    images: string[]
    alive?: boolean
    eventDate: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export class Pet {
    private events: PetEvent[] = []

    private constructor(private props: PetProps) {}

    static report(data: ReportPetData, context: { id: string; now: Date; ownerId?: string | null }): Pet {
        if (!REPORT_TYPES.includes(data.reportType)) {
            throw new ValidationError('Invalid report type', { field: 'reportType' })
        }
        if (!SPECIES.includes(data.species)) {
            throw new ValidationError('Invalid species', { field: 'species' })
        }

        const images = [...new Set(data.images)]
        if (images.length < PET_LIMITS.minImages || images.length > PET_LIMITS.maxImages) {
            throw new ValidationError(
                `A pet needs between ${PET_LIMITS.minImages} and ${PET_LIMITS.maxImages} images`,
                { field: 'images' }
            )
        }

        return new Pet({
            id: context.id,
            reportType: data.reportType,
            species: data.species,
            name: optionalText(data.name, 'name', PET_LIMITS.nameMaxLength),
            description: requiredText(data.description, 'description', PET_LIMITS.descriptionMaxLength),
            location: requiredText(data.location, 'location', PET_LIMITS.locationMaxLength),
            contact: requiredText(data.contact, 'contact', PET_LIMITS.contactMaxLength),
            images,
            alive: data.reportType === 'lost' ? true : data.alive ?? true,
            eventDate: validEventDate(data.eventDate, context.now),
            resolution: 'open',
            resolvedBy: null,
            resolvedAt: null,
            ownerId: context.ownerId ?? null,
            moderationStatus: 'pending_review',
            moderationScores: null,
            moderatedAt: null,
            createdAt: context.now
        })
    }

    static restore(props: PetProps): Pet {
        return new Pet({ ...props, images: [...props.images] })
    }

    get id(): string {
        return this.props.id
    }

    get isReunited(): boolean {
        return this.props.resolution === 'reunited'
    }

    /** Visible to everyone: approved by moderation. */
    get isPublic(): boolean {
        return this.props.moderationStatus === 'approved'
    }

    toSnapshot(): Readonly<PetProps> {
        return {
            ...this.props,
            images: [...this.props.images],
            moderationScores: this.props.moderationScores && { ...this.props.moderationScores }
        }
    }

    /** Events recorded since the pet was loaded; the repository stores them in the outbox. */
    pullEvents(): PetEvent[] {
        const events = this.events
        this.events = []
        return events
    }

    /** Records the automatic moderation of a new report. Rejected reports never become pets. */
    applyAutomaticModeration(status: ModerationStatus, scores: ModerationScores | null, now: Date): void {
        if (this.props.moderatedAt) throw new ConflictError('The pet was already moderated')

        this.props.moderationStatus = status
        this.props.moderationScores = scores
        this.props.moderatedAt = now
        if (status === 'approved') this.recordPublished(now)
    }

    /** An admin publishes a report that automatic moderation left for review. */
    approve(actor: Actor, now: Date): void {
        if (actor.kind !== 'admin') throw new ForbiddenError()
        if (this.isPublic) throw new ConflictError('The pet is already published')

        this.props.moderationStatus = 'approved'
        this.props.moderatedAt = now
        this.recordPublished(now)
    }

    canBeManagedBy(actor: Actor): boolean {
        if (actor.kind === 'admin') return true
        return actor.kind === 'user' && this.props.ownerId !== null && actor.userId === this.props.ownerId
    }

    assertCanBeManagedBy(actor: Actor): void {
        if (!this.canBeManagedBy(actor)) throw new ForbiddenError()
    }

    markAsReunited(actor: Actor, now: Date): void {
        this.assertCanBeManagedBy(actor)
        if (this.isReunited) throw new ConflictError('The pet is already reunited with its family')

        this.props.resolution = 'reunited'
        this.props.resolvedBy = actor.kind === 'admin' ? 'admin' : 'owner'
        this.props.resolvedAt = now
        this.events.push({ type: 'pet.reunited', occurredAt: now, payload: { petId: this.props.id } })
    }

    private recordPublished(now: Date): void {
        this.events.push({ type: 'pet.published', occurredAt: now, payload: { petId: this.props.id } })
    }
}

function requiredText(value: string, field: string, maxLength: number): string {
    const text = value?.trim() ?? ''
    if (text.length === 0) throw new ValidationError(`${field} is required`, { field })
    if (text.length > maxLength) throw new ValidationError(`${field} is too long`, { field, maxLength })
    return text
}

function optionalText(value: string | null | undefined, field: string, maxLength: number): string | null {
    const text = value?.trim() ?? ''
    if (text.length === 0) return null
    if (text.length > maxLength) throw new ValidationError(`${field} is too long`, { field, maxLength })
    return text
}

function validEventDate(value: string, now: Date): string {
    const date = new Date(`${value}T00:00:00Z`)
    if (!ISO_DATE.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
        throw new ValidationError('eventDate must be a valid YYYY-MM-DD date', { field: 'eventDate' })
    }
    // One day of tolerance so users in timezones ahead of the server are not rejected.
    if (date.getTime() > now.getTime() + ONE_DAY_MS) {
        throw new ValidationError('eventDate cannot be in the future', { field: 'eventDate' })
    }
    return value
}
