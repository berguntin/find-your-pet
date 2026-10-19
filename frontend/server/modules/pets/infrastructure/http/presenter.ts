import type { PetDescriptionDto, PetDto, PetPageDto } from '../../../../../contracts/pets'
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

export function toPetDescriptionDto(description: PetDescription | null): PetDescriptionDto {
    if (!description) {
        return { isPet: false, species: null, description: null, name: null, location: null, contact: null, eventDate: null }
    }
    return { isPet: true, ...description }
}
