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
