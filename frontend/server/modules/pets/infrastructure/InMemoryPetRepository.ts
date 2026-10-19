import type { Page } from '../../../shared/application/ports'
import { InMemoryOutboxStore } from '../../../shared/infrastructure/InMemoryOutboxStore'
import { Pet } from '../domain/Pet'
import type { PetRepository, PetSearchCriteria } from '../application/ports'

/** Test double that keeps pets in memory. Newest pets come first, like the Postgres adapter. */
export class InMemoryPetRepository implements PetRepository {
    private readonly pets = new Map<string, Pet>()

    constructor(readonly outbox = new InMemoryOutboxStore()) {}

    async save(pet: Pet): Promise<void> {
        this.pets.set(pet.id, Pet.restore(pet.toSnapshot()))
        this.outbox.append(pet.pullEvents())
    }

    async listAllImageUrls(): Promise<string[]> {
        return [...this.pets.values()].flatMap(pet => pet.toSnapshot().images)
    }

    async findById(id: string): Promise<Pet | null> {
        const pet = this.pets.get(id)
        return pet ? Pet.restore(pet.toSnapshot()) : null
    }

    async delete(id: string): Promise<void> {
        this.pets.delete(id)
    }

    async search(criteria: PetSearchCriteria): Promise<Page<Pet>> {
        const query = criteria.query?.toLowerCase()
        const matches = [...this.pets.values()]
            .map(pet => pet.toSnapshot())
            .filter(pet => !criteria.reportType || pet.reportType === criteria.reportType)
            .filter(pet => !criteria.species || pet.species === criteria.species)
            .filter(pet => !criteria.resolution || pet.resolution === criteria.resolution)
            .filter(pet => !criteria.moderationStatus || pet.moderationStatus === criteria.moderationStatus)
            .filter(
                pet =>
                    !query ||
                    [pet.name, pet.description, pet.location].some(text => text?.toLowerCase().includes(query))
            )
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))

        const start = criteria.cursor ? Number(criteria.cursor) : 0
        const items = matches.slice(start, start + criteria.limit)
        const next = start + criteria.limit
        return {
            items: items.map(pet => Pet.restore(pet)),
            nextCursor: next < matches.length ? String(next) : null
        }
    }
}
