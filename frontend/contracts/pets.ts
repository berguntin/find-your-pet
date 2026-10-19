/**
 * HTTP contract of the pets API, shared by the server handlers and the frontend.
 * Pure TypeScript + zod: never import Nuxt or server infrastructure here.
 */
import { z } from 'zod'
import {
    MODERATION_STATUSES,
    PET_LIMITS,
    REPORT_TYPES,
    RESOLUTIONS,
    SPECIES,
    type ModerationStatus,
    type ReportType,
    type Resolution,
    type ResolvedBy,
    type Species
} from '../server/modules/pets/domain/values'

export { MODERATION_STATUSES, PET_LIMITS, REPORT_TYPES, RESOLUTIONS, SPECIES }
export type { ModerationStatus, ReportType, Resolution, ResolvedBy, Species }

export const reportPetSchema = z.object({
    reportType: z.enum(REPORT_TYPES),
    species: z.enum(SPECIES),
    name: z.string().max(PET_LIMITS.nameMaxLength).nullish(),
    description: z.string().trim().min(1).max(PET_LIMITS.descriptionMaxLength),
    location: z.string().trim().min(1).max(PET_LIMITS.locationMaxLength),
    contact: z.string().trim().min(1).max(PET_LIMITS.contactMaxLength),
    alive: z.boolean().default(true),
    eventDate: z.string().date(),
    images: z.array(z.string().url()).min(PET_LIMITS.minImages).max(PET_LIMITS.maxImages)
})
export type ReportPetRequest = z.input<typeof reportPetSchema>

export const listPetsQuerySchema = z.object({
    reportType: z.enum(REPORT_TYPES).optional(),
    species: z.enum(SPECIES).optional(),
    resolution: z.enum(RESOLUTIONS).optional(),
    q: z.string().trim().max(100).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(24)
})
export type ListPetsQuery = z.input<typeof listPetsQuerySchema>

export const adminListPetsQuerySchema = listPetsQuerySchema.extend({
    moderationStatus: z.enum(MODERATION_STATUSES).optional()
})

export const moderatePetSchema = z.object({
    status: z.enum(['approved', 'rejected'])
})
export type ModeratePetRequest = z.input<typeof moderatePetSchema>

export const updatePetSchema = z.object({
    resolution: z.literal('reunited')
})
export type UpdatePetRequest = z.input<typeof updatePetSchema>

/** ~1.5 MB of base64: the client resizes images before sending them for analysis. */
export const describePetSchema = z.object({
    image: z
        .string()
        .regex(/^data:image\/(jpeg|png|webp);base64,/)
        .max(2_000_000)
})
export type DescribePetRequest = z.input<typeof describePetSchema>

export const petIdSchema = z.string().uuid()

export interface PetDto {
    id: string
    reportType: ReportType
    species: Species
    name: string | null
    description: string
    location: string
    contact: string
    images: string[]
    alive: boolean
    eventDate: string
    resolution: Resolution
    resolvedBy: ResolvedBy | null
    resolvedAt: string | null
    /** `pending_review` pets are only returned to whoever reported or manages them. */
    moderationStatus: ModerationStatus
    createdAt: string
}

export interface PetPageDto {
    items: PetDto[]
    nextCursor: string | null
}

export interface PetDescriptionDto {
    isPet: boolean
    species: Species | null
    description: string | null
    name: string | null
    location: string | null
    contact: string | null
    eventDate: string | null
}

export interface UploadAuthorizationDto {
    uploadUrl: string
    fields: Record<string, string>
}

export interface ApiErrorDto {
    error: {
        code:
            | 'validation'
            | 'content_rejected'
            | 'not_found'
            | 'forbidden'
            | 'conflict'
            | 'unauthorized'
            | 'rate_limited'
            | 'internal'
        message: string
        details?: Record<string, unknown>
    }
}
