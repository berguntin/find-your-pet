import type { Page } from '../../../shared/application/ports'
import { ValidationError } from '../../../shared/domain/errors'
import type { Database } from '../../../shared/infrastructure/database'
import type { PetRepository, PetSearchCriteria } from '../application/ports'
import { Pet } from '../domain/Pet'
import type { ReportType, Resolution, ResolvedBy, Species } from '../domain/values'

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
    'created_at'
] as const

export class PostgresPetRepository implements PetRepository {
    constructor(private readonly sql: Database) {}

    async save(pet: Pet): Promise<void> {
        // postgres.js cannot map a typed row interface to its parameter types, hence the cast.
        const row = toRow(pet) as never
        await this.sql`
            insert into pets ${this.sql(row, COLUMNS)}
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
                owner_id = excluded.owner_id
        `
    }

    async findById(id: string): Promise<Pet | null> {
        const [row] = await this.sql<PetRow[]>`select ${this.sql(COLUMNS)} from pets where id = ${id}`
        return row ? toDomain(row) : null
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
