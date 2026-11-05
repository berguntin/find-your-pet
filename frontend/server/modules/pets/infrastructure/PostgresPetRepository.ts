import type { Page } from '../../../shared/application/ports'
import { ValidationError } from '../../../shared/domain/errors'
import type { Database } from '../../../shared/infrastructure/database'
import { appendToOutbox } from '../../../shared/infrastructure/PostgresOutboxStore'
import type { DailyPetActivity, PetRepository, PetSearchCriteria, PetStateCount } from '../application/ports'
import type { ModerationScores } from '../domain/moderation'
import { Pet } from '../domain/Pet'
import type { ModerationStatus, ReportType, Resolution, ResolvedBy, Species } from '../domain/values'

interface PetRow {
    id: string
    report_type: ReportType
    species: Species
    name: string | null
    description: string
    location: string
    contact: string
    images: string[]
    alive: boolean
    event_date: string
    resolution: Resolution
    resolved_by: ResolvedBy | null
    resolved_at: Date | null
    owner_id: string | null
    moderation_status: ModerationStatus
    moderation_scores: ModerationScores | null
    moderated_at: Date | null
    created_at: Date
}

const COLUMNS = [
    'id',
    'report_type',
    'species',
    'name',
    'description',
    'location',
    'contact',
    'images',
    'alive',
    'event_date',
    'resolution',
    'resolved_by',
    'resolved_at',
    'owner_id',
    'moderation_status',
    'moderation_scores',
    'moderated_at',
    'created_at'
] as const

export class PostgresPetRepository implements PetRepository {
    constructor(private readonly sql: Database) {}

    /** Stores the pet and its recorded events atomically. */
    async save(pet: Pet): Promise<void> {
        const events = pet.pullEvents()
        await this.sql.begin(async transaction => {
            const sql = transaction as unknown as Database
            await this.upsert(sql, pet)
            await appendToOutbox(sql, events)
        })
    }

    private async upsert(sql: Database, pet: Pet): Promise<void> {
        const row = toRow(pet)
        // postgres.js cannot map a typed row interface to its parameter types, hence the cast.
        const values = {
            ...row,
            moderation_scores: row.moderation_scores && sql.json(row.moderation_scores as never)
        } as never
        await sql`
            insert into pets ${sql(values, COLUMNS)}
            on conflict (id) do update set
                report_type = excluded.report_type,
                species = excluded.species,
                name = excluded.name,
                description = excluded.description,
                location = excluded.location,
                contact = excluded.contact,
                images = excluded.images,
                alive = excluded.alive,
                event_date = excluded.event_date,
                resolution = excluded.resolution,
                resolved_by = excluded.resolved_by,
                resolved_at = excluded.resolved_at,
                owner_id = excluded.owner_id,
                moderation_status = excluded.moderation_status,
                moderation_scores = excluded.moderation_scores,
                moderated_at = excluded.moderated_at
        `
    }

    async listAllImageUrls(): Promise<string[]> {
        const rows = await this.sql<{ url: string }[]>`select distinct unnest(images) as url from pets`
        return rows.map(row => row.url)
    }

    async countDailyActivity(since: Date, timeZone: string): Promise<DailyPetActivity[]> {
        const sql = this.sql
        return sql<DailyPetActivity[]>`
            select to_char(created_at at time zone ${timeZone}, 'YYYY-MM-DD') as day, 'reported' as kind,
                report_type as "reportType", species, count(*)::int as count
            from pets where created_at >= ${since}
            group by 1, 3, 4
            union all
            select to_char(resolved_at at time zone ${timeZone}, 'YYYY-MM-DD'), 'reunited',
                report_type, species, count(*)::int
            from pets where resolution = 'reunited' and resolved_at >= ${since}
            group by 1, 3, 4
        `
    }

    async countByState(): Promise<PetStateCount[]> {
        return this.sql<PetStateCount[]>`
            select report_type as "reportType", resolution, moderation_status as "moderationStatus",
                count(*)::int as count
            from pets
            group by 1, 2, 3
        `
    }

    async findById(id: string): Promise<Pet | null> {
        const [row] = await this.sql<PetRow[]>`select ${this.sql(COLUMNS)} from pets where id = ${id}`
        return row ? toDomain(row) : null
    }

    async findByIds(ids: string[]): Promise<Pet[]> {
        if (ids.length === 0) return []
        const rows = await this.sql<PetRow[]>`select ${this.sql(COLUMNS)} from pets where id = any(${ids}::uuid[])`
        return rows.map(toDomain)
    }

    async delete(id: string): Promise<void> {
        await this.sql`delete from pets where id = ${id}`
    }

    async search(criteria: PetSearchCriteria): Promise<Page<Pet>> {
        const sql = this.sql
        const cursor = criteria.cursor ? decodeCursor(criteria.cursor) : null
        const pattern = criteria.query ? `%${escapeLike(criteria.query)}%` : null

        const rows = await sql<PetRow[]>`
            select ${sql(COLUMNS)} from pets
            where true
                ${criteria.reportType ? sql`and report_type = ${criteria.reportType}` : sql``}
                ${criteria.species ? sql`and species = ${criteria.species}` : sql``}
                ${criteria.resolution ? sql`and resolution = ${criteria.resolution}` : sql``}
                ${criteria.moderationStatus ? sql`and moderation_status = ${criteria.moderationStatus}` : sql``}
                ${
                    pattern
                        ? sql`and (name ilike ${pattern} or description ilike ${pattern} or location ilike ${pattern})`
                        : sql``
                }
                ${cursor ? sql`and (created_at, id) < (${cursor.createdAt}, ${cursor.id})` : sql``}
            order by created_at desc, id desc
            limit ${criteria.limit + 1}
        `

        const hasMore = rows.length > criteria.limit
        const items = rows.slice(0, criteria.limit)
        const last = items.at(-1)
        return {
            items: items.map(toDomain),
            nextCursor: hasMore && last ? encodeCursor(last) : null
        }
    }
}

function toRow(pet: Pet): PetRow {
    const p = pet.toSnapshot()
    return {
        id: p.id,
        report_type: p.reportType,
        species: p.species,
        name: p.name,
        description: p.description,
        location: p.location,
        contact: p.contact,
        images: p.images,
        alive: p.alive,
        event_date: p.eventDate,
        resolution: p.resolution,
        resolved_by: p.resolvedBy,
        resolved_at: p.resolvedAt,
        owner_id: p.ownerId,
        moderation_status: p.moderationStatus,
        moderation_scores: p.moderationScores,
        moderated_at: p.moderatedAt,
        created_at: p.createdAt
    }
}

function toDomain(row: PetRow): Pet {
    return Pet.restore({
        id: row.id,
        reportType: row.report_type,
        species: row.species,
        name: row.name,
        description: row.description,
        location: row.location,
        contact: row.contact,
        images: row.images,
        alive: row.alive,
        eventDate: row.event_date,
        resolution: row.resolution,
        resolvedBy: row.resolved_by,
        resolvedAt: row.resolved_at,
        ownerId: row.owner_id,
        moderationStatus: row.moderation_status,
        moderationScores: row.moderation_scores,
        moderatedAt: row.moderated_at,
        createdAt: row.created_at
    })
}

function encodeCursor(row: PetRow): string {
    return Buffer.from(`${row.created_at.toISOString()}|${row.id}`).toString('base64url')
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } {
    const [createdAt, id] = Buffer.from(cursor, 'base64url').toString().split('|')
    const date = new Date(createdAt ?? '')
    if (!id || Number.isNaN(date.getTime())) throw new ValidationError('Invalid cursor', { field: 'cursor' })
    return { createdAt: date, id }
}

function escapeLike(text: string): string {
    return text.replace(/[\\%_]/g, char => `\\${char}`)
}
