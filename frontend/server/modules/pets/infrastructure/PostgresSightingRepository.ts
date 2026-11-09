import type { Database } from '../../../shared/infrastructure/database'
import { appendToOutbox } from '../../../shared/infrastructure/PostgresOutboxStore'
import { StaleSightingError, type SightingRepository } from '../application/ports'
import type { ModerationScores } from '../domain/moderation'
import { Sighting, type SightingValidation } from '../domain/Sighting'
import type { ModerationStatus, SightingVerifiedBy } from '../domain/values'

interface SightingRow {
    id: string
    pet_id: string
    author_id: string | null
    description: string
    area: string
    seen_at: Date
    images: string[]
    moderation_status: ModerationStatus
    moderation_scores: ModerationScores | null
    moderated_at: Date | null
    verified_at: Date | null
    verified_by: SightingVerifiedBy | null
    version: number
    created_at: Date
}

interface ValidationRow {
    sighting_id: string
    user_id: string
    weight: number
    created_at: Date
}

export class PostgresSightingRepository implements SightingRepository {
    constructor(private readonly sql: Database) {}

    async add(sighting: Sighting): Promise<void> {
        const s = sighting.toSnapshot()
        const events = sighting.pullEvents()
        await this.sql.begin(async transaction => {
            // Same cast as PostgresPetRepository: the transaction is used like the pool.
            const sql = transaction as unknown as Database
            await sql`
                insert into pet_sightings (
                    id, pet_id, author_id, description, area, seen_at, images, moderation_status,
                    moderation_scores, moderated_at, verified_at, verified_by, version, created_at
                ) values (
                    ${s.id}, ${s.petId}, ${s.authorId}, ${s.description}, ${s.area}, ${s.seenAt}, ${s.images},
                    ${s.moderationStatus}, ${s.moderationScores && sql.json(s.moderationScores as never)},
                    ${s.moderatedAt}, ${s.verifiedAt}, ${s.verifiedBy}, 0, ${s.createdAt}
                )
            `
            await this.insertValidations(sql, s.id, s.validations)
            await appendToOutbox(sql, events)
        })
    }

    async save(sighting: Sighting): Promise<void> {
        const s = sighting.toSnapshot()
        const events = sighting.pullEvents()
        await this.sql.begin(async transaction => {
            const sql = transaction as unknown as Database
            // Optimistic locking: only if nobody saved (or deleted) it since it was loaded.
            const updated = await sql`
                update pet_sightings set
                    description = ${s.description},
                    area = ${s.area},
                    seen_at = ${s.seenAt},
                    images = ${s.images},
                    moderation_status = ${s.moderationStatus},
                    moderation_scores = ${s.moderationScores && sql.json(s.moderationScores as never)},
                    moderated_at = ${s.moderatedAt},
                    verified_at = ${s.verifiedAt},
                    verified_by = ${s.verifiedBy},
                    version = version + 1
                where id = ${s.id} and version = ${s.version}
                returning id
            `
            if (updated.length === 0) throw new StaleSightingError()
            await this.insertValidations(sql, s.id, s.validations)
            await appendToOutbox(sql, events)
        })
    }

    private async insertValidations(sql: Database, sightingId: string, validations: SightingValidation[]) {
        for (const validation of validations) {
            await sql`
                insert into sighting_validations (sighting_id, user_id, weight, created_at)
                values (${sightingId}, ${validation.userId}, ${validation.weight}, ${validation.createdAt})
                on conflict (sighting_id, user_id) do nothing
            `
        }
    }

    async findById(id: string): Promise<Sighting | null> {
        const rows = await this.sql<SightingRow[]>`select * from pet_sightings where id = ${id}`
        return (await this.withValidations(rows))[0] ?? null
    }

    async listByPet(
        petId: string,
        {
            includeAuthorId = null,
            includeAll = false,
            limit
        }: { includeAuthorId?: string | null; includeAll?: boolean; limit: number }
    ): Promise<Sighting[]> {
        const rows = await this.sql<SightingRow[]>`
            select * from pet_sightings
            where pet_id = ${petId}
                and (${includeAll} or moderation_status = 'approved' or author_id = ${includeAuthorId})
            order by seen_at desc, id desc
            limit ${limit}
        `
        return this.withValidations(rows)
    }

    async listByStatus(status: ModerationStatus, limit: number): Promise<Sighting[]> {
        const rows = await this.sql<SightingRow[]>`
            select * from pet_sightings where moderation_status = ${status}
            order by created_at desc, id desc limit ${limit}
        `
        return this.withValidations(rows)
    }

    async delete(id: string): Promise<void> {
        await this.sql`delete from pet_sightings where id = ${id}`
    }

    async listAllImageUrls(): Promise<string[]> {
        const rows = await this.sql<{ url: string }[]>`select unnest(images) as url from pet_sightings`
        return rows.map(row => row.url)
    }

    private async withValidations(rows: SightingRow[]): Promise<Sighting[]> {
        if (rows.length === 0) return []
        const validations = await this.sql<ValidationRow[]>`
            select * from sighting_validations
            where sighting_id = any(${rows.map(row => row.id)}::uuid[])
            order by created_at, user_id
        `
        const bySighting = new Map<string, SightingValidation[]>()
        for (const row of validations) {
            const list = bySighting.get(row.sighting_id) ?? []
            list.push({ userId: row.user_id, weight: row.weight, createdAt: row.created_at })
            bySighting.set(row.sighting_id, list)
        }
        return rows.map(row =>
            Sighting.restore({
                id: row.id,
                petId: row.pet_id,
                authorId: row.author_id,
                description: row.description,
                area: row.area,
                seenAt: row.seen_at,
                images: row.images,
                moderationStatus: row.moderation_status,
                moderationScores: row.moderation_scores,
                moderatedAt: row.moderated_at,
                verifiedAt: row.verified_at,
                verifiedBy: row.verified_by,
                validations: bySighting.get(row.id) ?? [],
                version: row.version,
                createdAt: row.created_at
            })
        )
    }
}
