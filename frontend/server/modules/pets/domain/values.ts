export const SPECIES = ['dog', 'cat', 'other'] as const
export type Species = (typeof SPECIES)[number]

/** Whether the person reporting lost the pet or found it. */
export const REPORT_TYPES = ['lost', 'found'] as const
export type ReportType = (typeof REPORT_TYPES)[number]

/** Whether the case is still open or the pet is back with its family. */
export const RESOLUTIONS = ['open', 'reunited'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export const RESOLVED_BY = ['owner', 'community', 'admin'] as const
export type ResolvedBy = (typeof RESOLVED_BY)[number]

export const PET_LIMITS = {
    minImages: 1,
    maxImages: 10,
    nameMaxLength: 60,
    descriptionMaxLength: 2000,
    locationMaxLength: 120,
    contactMaxLength: 200
} as const

/** Only approved pets are public. Rejected reports are never stored. */
export const MODERATION_STATUSES = ['approved', 'pending_review'] as const
export type ModerationStatus = (typeof MODERATION_STATUSES)[number]

export const SIGHTING_LIMITS = {
    descriptionMinLength: 10,
    descriptionMaxLength: 1000,
    areaMinLength: 2,
    areaMaxLength: 120,
    maxImages: 3,
    /** How far back a sighting can be dated. */
    maxAgeDays: 365
} as const

/** Points that make a sighting verified: each user adds 1, the pet's owner adds 3 (enough on their own). */
export const SIGHTING_VERIFICATION = { threshold: 3, userWeight: 1, ownerWeight: 3 } as const

export const SIGHTING_VERIFIED_BY = ['community', 'owner'] as const
export type SightingVerifiedBy = (typeof SIGHTING_VERIFIED_BY)[number]
