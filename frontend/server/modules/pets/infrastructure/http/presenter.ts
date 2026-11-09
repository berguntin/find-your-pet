import type { PetDescriptionDto, PetDto, PetMatchListDto, PetPageDto } from '../../../../../contracts/pets'
import type { AdminPetDto, AdminPetPageDto, ModerationOverviewDto } from '../../../../../contracts/admin'
import type { PetMatch } from '../../application/search'
import type { ModerationOverview } from '../../application/stats'
import type { Page } from '../../../../shared/application/ports'
import type { PetDescription } from '../../application/ports'
import type { Pet } from '../../domain/Pet'
import type { AdminSightingDto, SightingDto, SightingListDto } from '../../../../../contracts/sightings'
import type { PetSightings, SightingView } from '../../application/sightings'
import type { Sighting } from '../../domain/Sighting'
import { SIGHTING_VERIFICATION } from '../../domain/values'

/** Owner ids are internal: they are never exposed through the API. */
export function toPetDto(pet: Pet): PetDto {
    const {
        ownerId: _ownerId,
        moderationScores: _moderationScores,
        moderatedAt: _moderatedAt,
        resolvedAt,
        createdAt,
        ...rest
    } = pet.toSnapshot()
    return {
        ...rest,
        resolvedAt: resolvedAt?.toISOString() ?? null,
        createdAt: createdAt.toISOString()
    }
}

export function toPetPageDto(page: Page<Pet>): PetPageDto {
    return { items: page.items.map(toPetDto), nextCursor: page.nextCursor }
}

export function toPetMatchListDto(matches: PetMatch[]): PetMatchListDto {
    return { items: matches.map(({ pet, match }) => ({ pet: toPetDto(pet), match })) }
}

export function toPetDescriptionDto(description: PetDescription | null): PetDescriptionDto {
    if (!description) {
        return {
            isPet: false,
            species: null,
            description: null,
            name: null,
            location: null,
            contact: null,
            eventDate: null
        }
    }
    return { isPet: true, ...description }
}

/** Admins also see the moderation scores and when the pet was moderated. */
export function toAdminPetDto(pet: Pet): AdminPetDto {
    const { moderationScores, moderatedAt } = pet.toSnapshot()
    return { ...toPetDto(pet), moderationScores, moderatedAt: moderatedAt?.toISOString() ?? null }
}

export function toAdminPetPageDto(page: Page<Pet>): AdminPetPageDto {
    return { items: page.items.map(toAdminPetDto), nextCursor: page.nextCursor }
}

export function toModerationOverviewDto(overview: ModerationOverview): ModerationOverviewDto {
    return {
        ...overview,
        recent: overview.recent.map(record => ({ ...record, decidedAt: record.decidedAt.toISOString() }))
    }
}

function sightingFields(sighting: Sighting) {
    const s = sighting.toSnapshot()
    return {
        id: s.id,
        petId: s.petId,
        description: s.description,
        area: s.area,
        seenAt: s.seenAt.toISOString(),
        images: s.images,
        moderationStatus: s.moderationStatus,
        points: sighting.points,
        verified: sighting.isVerified,
        verifiedBy: s.verifiedBy,
        createdAt: s.createdAt.toISOString()
    }
}

/** Author ids and who validated stay internal: viewers only learn about themselves. */
export function toSightingDto({ sighting, authorName, viewer }: SightingView): SightingDto {
    return { ...sightingFields(sighting), authorName, viewer }
}

export function toSightingListDto({ items, viewerIsPetOwner }: PetSightings): SightingListDto {
    return { items: items.map(toSightingDto), threshold: SIGHTING_VERIFICATION.threshold, viewerIsPetOwner }
}

export function toAdminSightingDto(sighting: Sighting): AdminSightingDto {
    const { moderationScores, moderatedAt } = sighting.toSnapshot()
    return { ...sightingFields(sighting), moderationScores, moderatedAt: moderatedAt?.toISOString() ?? null }
}
