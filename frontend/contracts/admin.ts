/**
 * HTTP contract of the admin API (/api/v1/admin), shared by the server handlers and the admin panel.
 * Pure TypeScript + zod: never import Nuxt or server infrastructure here.
 */
import { z } from 'zod'
import type { ModerationThresholds } from '../server/modules/pets/domain/moderation'
import {
    listPetsQuerySchema,
    MODERATION_STATUSES,
    PET_LIMITS,
    REPORT_TYPES,
    RESOLUTIONS,
    SPECIES,
    type PetDto,
    type ReportType,
    type Species
} from './pets'

export const adminListPetsQuerySchema = listPetsQuerySchema.extend({
    /** `all` lists every pet; omitted means pending review. */
    moderationStatus: z.enum([...MODERATION_STATUSES, 'all']).optional()
})
export type AdminListPetsQuery = z.input<typeof adminListPetsQuerySchema>

/** Publish, hide a published pet back to review, or reject (delete) a report. */
export const moderatePetSchema = z.object({
    status: z.enum(['approved', 'pending_review', 'rejected'])
})
export type ModeratePetRequest = z.input<typeof moderatePetSchema>

/** Any reported detail and the resolution; omitted fields keep their value. */
export const adminUpdatePetSchema = z
    .object({
        reportType: z.enum(REPORT_TYPES),
        species: z.enum(SPECIES),
        name: z.string().max(PET_LIMITS.nameMaxLength).nullable(),
        description: z.string().trim().min(1).max(PET_LIMITS.descriptionMaxLength),
        location: z.string().trim().min(1).max(PET_LIMITS.locationMaxLength),
        contact: z.string().trim().min(1).max(PET_LIMITS.contactMaxLength),
        alive: z.boolean(),
        eventDate: z.string().date(),
        images: z.array(z.string().url()).min(PET_LIMITS.minImages).max(PET_LIMITS.maxImages),
        resolution: z.enum(RESOLUTIONS)
    })
    .partial()
    .strict()
export type AdminUpdatePetRequest = z.input<typeof adminUpdatePetSchema>

export const STATS_PERIODS = [7, 30, 90] as const

export const adminStatsQuerySchema = z.object({
    days: z.coerce
        .number()
        .int()
        .refine(days => (STATS_PERIODS as readonly number[]).includes(days), 'days must be 7, 30 or 90')
        .default(30)
})
export type AdminStatsQuery = z.input<typeof adminStatsQuerySchema>

export interface ModerationScoresDto {
    isPetReport: number | null
    showsAnimal: number | null
    inappropriate: number | null
}

/** A pet with the moderation details only admins see. */
export interface AdminPetDto extends PetDto {
    moderationScores: ModerationScoresDto | null
    moderatedAt: string | null
}

export interface AdminPetPageDto {
    items: AdminPetDto[]
    nextCursor: string | null
}

export interface PetPeriodStatsDto {
    lost: number
    found: number
    reunited: number
    lostBySpecies: Record<Species, number>
}

export interface PetStatsDto {
    days: number
    timeZone: string
    daily: { day: string; lost: number; found: number; reunited: number }[]
    period: PetPeriodStatsDto
    previousPeriod: PetPeriodStatsDto
    totals: {
        all: number
        published: number
        pendingReview: number
        open: Record<ReportType, number>
        reunited: number
    }
}

export interface ModerationDecisionDto {
    id: string
    petId: string | null
    source: 'automatic' | 'admin'
    decision: 'approved' | 'pending_review' | 'rejected'
    scores: ModerationScoresDto | null
    model: string | null
    error: string | null
    latencyMs: number | null
    submission: {
        reportType: ReportType
        species: Species
        name: string | null
        description: string
        location: string
    } | null
    decidedAt: string
}

export interface ModerationOverviewDto {
    days: number
    timeZone: string
    moderator: { enabled: boolean; model: string | null; thresholds: ModerationThresholds }
    automatic: {
        total: number
        approved: number
        pendingReview: number
        rejected: number
        failed: number
        averageLatencyMs: number | null
    }
    admin: { approved: number; pendingReview: number; rejected: number }
    pendingReview: number
    daily: { day: string; approved: number; pendingReview: number; rejected: number; failed: number }[]
    recent: ModerationDecisionDto[]
}
