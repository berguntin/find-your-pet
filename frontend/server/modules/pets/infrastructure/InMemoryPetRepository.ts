import type { Page } from '../../../shared/application/ports'
import { InMemoryOutboxStore } from '../../../shared/infrastructure/InMemoryOutboxStore'
import { Pet, type PetProps } from '../domain/Pet'
import type { DailyPetActivity, PetRepository, PetSearchCriteria, PetStateCount } from '../application/ports'
import { calendarDay } from '../application/stats'

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

    async countDailyActivity(since: Date, timeZone: string): Promise<DailyPetActivity[]> {
        const counts = new Map<string, DailyPetActivity>()
        const add = (date: Date, kind: DailyPetActivity['kind'], pet: Pick<PetProps, 'reportType' | 'species'>) => {
            const day = calendarDay(date, timeZone)
            const key = [day, kind, pet.reportType, pet.species].join('|')
            const row = counts.get(key) ?? { day, kind, reportType: pet.reportType, species: pet.species, count: 0 }
            row.count++
            counts.set(key, row)
        }
        for (const pet of [...this.pets.values()].map(p => p.toSnapshot())) {
            if (pet.createdAt >= since) add(pet.createdAt, 'reported', pet)
            if (pet.resolution === 'reunited' && pet.resolvedAt && pet.resolvedAt >= since)
                add(pet.resolvedAt, 'reunited', pet)
        }
        return [...counts.values()]
    }

    async countByState(): Promise<PetStateCount[]> {
        const counts = new Map<string, PetStateCount>()
        for (const { reportType, resolution, moderationStatus } of [...this.pets.values()].map(p => p.toSnapshot())) {
            const key = [reportType, resolution, moderationStatus].join('|')
            const row = counts.get(key) ?? { reportType, resolution, moderationStatus, count: 0 }
            row.count++
            counts.set(key, row)
        }
        return [...counts.values()]
    }

    async findById(id: string): Promise<Pet | null> {
        const pet = this.pets.get(id)
        return pet ? Pet.restore(pet.toSnapshot()) : null
    }

    async findByIds(ids: string[]): Promise<Pet[]> {
        return ids.flatMap(id => {
            const pet = this.pets.get(id)
            return pet ? [Pet.restore(pet.toSnapshot())] : []
        })
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
