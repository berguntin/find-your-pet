import type { PetDescriptionDto, PetDto, PetMatchListDto, PetPageDto } from '../../../../../contracts/pets'
import type { AdminPetDto, AdminPetPageDto, ModerationOverviewDto } from '../../../../../contracts/admin'
import type { PetMatch } from '../../application/search'
import type { ModerationOverview } from '../../application/stats'
import type { Page } from '../../../../shared/application/ports'
import type { PetDescription } from '../../application/ports'
import type { Pet } from '../../domain/Pet'

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
