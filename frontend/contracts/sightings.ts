/**
 * HTTP contract of pet sightings, shared by the server handlers and the frontend.
 * Pure TypeScript + zod: never import Nuxt or server infrastructure here.
 */
import { z } from 'zod'
import {
    MODERATION_STATUSES,
    SIGHTING_LIMITS,
    SIGHTING_VERIFICATION,
    type ModerationStatus,
    type SightingVerifiedBy
} from '../server/modules/pets/domain/values'
import type { ModerationScoresDto } from './admin'

export { SIGHTING_LIMITS, SIGHTING_VERIFICATION }
export type { SightingVerifiedBy }

export const reportSightingSchema = z.object({
    description: z.string().trim().min(SIGHTING_LIMITS.descriptionMinLength).max(SIGHTING_LIMITS.descriptionMaxLength),
    area: z.string().trim().min(SIGHTING_LIMITS.areaMinLength).max(SIGHTING_LIMITS.areaMaxLength),
    /** When it was seen, ISO 8601 with offset. */
    seenAt: z.string().datetime({ offset: true }),
    images: z.array(z.string().url()).max(SIGHTING_LIMITS.maxImages).default([])
})
export type ReportSightingRequest = z.input<typeof reportSightingSchema>

export const sightingIdSchema = z.string().uuid()

export const adminSightingsQuerySchema = z.object({
    status: z.enum(MODERATION_STATUSES).default('pending_review')
})

export interface SightingDto {
    id: string
    petId: string
    description: string
    area: string
    seenAt: string
    images: string[]
    /** First name of whoever reported it; null if they deleted their account. */
    authorName: string | null
    /** Only the author (and admins) see their sightings while they wait for review. */
    moderationStatus: ModerationStatus
    points: number
    verified: boolean
    verifiedBy: SightingVerifiedBy | null
    createdAt: string
    /** What the viewer may do; `canHide` is for the pet's owner (sends it back to review). */
    viewer: { isAuthor: boolean; hasValidated: boolean; canValidate: boolean; canHide: boolean }
}

export interface SightingListDto {
    items: SightingDto[]
    /** Points needed to verify a sighting. */
    threshold: number
    /** The viewer reported this pet: their confirmation verifies a sighting on its own. */
    viewerIsPetOwner: boolean
}

export interface AdminSightingDto extends Omit<SightingDto, 'authorName' | 'viewer'> {
    moderationScores: ModerationScoresDto | null
    moderatedAt: string | null
}

export interface AdminSightingListDto {
    items: AdminSightingDto[]
}
