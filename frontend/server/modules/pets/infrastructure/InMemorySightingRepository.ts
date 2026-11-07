import { InMemoryOutboxStore } from '../../../shared/infrastructure/InMemoryOutboxStore'
import { StaleSightingError, type SightingRepository } from '../application/ports'
import { Sighting } from '../domain/Sighting'
import type { ModerationStatus } from '../domain/values'

/** Test double that keeps sightings in memory, with the same optimistic locking as Postgres. */
export class InMemorySightingRepository implements SightingRepository {
    private readonly sightings = new Map<string, Sighting>()

    constructor(readonly outbox = new InMemoryOutboxStore()) {}

    async add(sighting: Sighting): Promise<void> {
        const snapshot = sighting.toSnapshot()
        if (this.sightings.has(snapshot.id)) throw new Error('Duplicate sighting id')
        this.sightings.set(snapshot.id, Sighting.restore({ ...snapshot, version: 0 }))
        this.outbox.append(sighting.pullEvents())
    }

    async save(sighting: Sighting): Promise<void> {
        const snapshot = sighting.toSnapshot()
        const stored = this.sightings.get(snapshot.id)?.toSnapshot()
        if (!stored || stored.version !== snapshot.version) throw new StaleSightingError()
        this.sightings.set(snapshot.id, Sighting.restore({ ...snapshot, version: stored.version + 1 }))
        this.outbox.append(sighting.pullEvents())
    }

    async findById(id: string): Promise<Sighting | null> {
        const sighting = this.sightings.get(id)
        return sighting ? Sighting.restore(sighting.toSnapshot()) : null
    }

    async listByPet(
        petId: string,
        {
            includeAuthorId = null,
            includeAll = false,
            limit
        }: { includeAuthorId?: string | null; includeAll?: boolean; limit: number }
    ): Promise<Sighting[]> {
        return this.all()
            .filter(sighting => sighting.petId === petId)
            .filter(sighting => includeAll || sighting.isPublic || sighting.isAuthor(includeAuthorId))
            .sort((a, b) => b.toSnapshot().seenAt.getTime() - a.toSnapshot().seenAt.getTime())
            .slice(0, limit)
    }

    async listByStatus(status: ModerationStatus, limit: number): Promise<Sighting[]> {
        return this.all()
            .filter(sighting => sighting.toSnapshot().moderationStatus === status)
            .sort((a, b) => b.toSnapshot().createdAt.getTime() - a.toSnapshot().createdAt.getTime())
            .slice(0, limit)
    }

    async delete(id: string): Promise<void> {
        this.sightings.delete(id)
    }

    async listAllImageUrls(): Promise<string[]> {
        return this.all().flatMap(sighting => sighting.toSnapshot().images)
    }

    /** Mirrors `on delete cascade` from pets. */
    deleteByPet(petId: string): void {
        for (const sighting of this.all()) if (sighting.petId === petId) this.sightings.delete(sighting.id)
    }

    private all(): Sighting[] {
        return [...this.sightings.values()].map(sighting => Sighting.restore(sighting.toSnapshot()))
    }
}
