import { beforeEach, describe, expect, it } from 'vitest'
import type { Actor } from '../../../shared/domain/actor'
import { ForbiddenError, NotFoundError, ValidationError } from '../../../shared/domain/errors'
import type { ReportPetData } from '../domain/Pet'
import { InMemoryPetRepository } from '../infrastructure/InMemoryPetRepository'
import type { ImageStorage } from './ports'
import { DeletePet, GetPet, ListPets, MarkPetAsReunited, ReportPet } from './useCases'

const MANAGED = 'https://storage.test/pets/'
const images: ImageStorage = {
    isManagedUrl: url => url.startsWith(MANAGED),
    authorizeUpload: () => ({ uploadUrl: 'https://storage.test/upload', fields: {} })
}

const anonymous: Actor = { kind: 'anonymous' }
const admin: Actor = { kind: 'admin' }

const data = (overrides: Partial<ReportPetData> = {}): ReportPetData => ({
    reportType: 'lost',
    species: 'cat',
    description: 'Gata blanca',
    location: 'Valencia',
    contact: 'ana@example.com',
    images: [`${MANAGED}1.jpg`],
    eventDate: '2026-10-01',
    ...overrides
})

describe('pet use cases', () => {
    let repository: InMemoryPetRepository
    let reportPet: ReportPet
    let seconds: number
    let counter: number

    beforeEach(() => {
        repository = new InMemoryPetRepository()
        seconds = 0
        counter = 0
        const clock = { now: () => new Date(Date.UTC(2026, 9, 19, 10, 0, seconds++)) }
        const ids = { next: () => `pet-${++counter}` }
        reportPet = new ReportPet(repository, images, clock, ids)
    })

    it('reports a pet and stores it', async () => {
        const pet = await reportPet.execute(data(), anonymous)

        expect(await new GetPet(repository).execute(pet.id)).toBeDefined()
    })

    it('assigns the owner when a user reports', async () => {
        const pet = await reportPet.execute(data(), { kind: 'user', userId: 'user-1' })

        expect(pet.toSnapshot().ownerId).toBe('user-1')
    })

    it('rejects images that were not uploaded through the app', async () => {
        await expect(reportPet.execute(data({ images: ['https://evil.test/x.jpg'] }), anonymous)).rejects.toThrow(
            ValidationError
        )
    })

    it('fails with NotFound for unknown pets', async () => {
        await expect(new GetPet(repository).execute('missing')).rejects.toThrow(NotFoundError)
    })

    it('lists newest first, filters and paginates', async () => {
        await reportPet.execute(data({ description: 'primero' }), anonymous)
        await reportPet.execute(data({ reportType: 'found', description: 'segundo' }), anonymous)
        await reportPet.execute(data({ description: 'tercero' }), anonymous)

        const list = new ListPets(repository)
        const firstPage = await list.execute({ limit: 2 })
        const secondPage = await list.execute({ limit: 2, cursor: firstPage.nextCursor! })
        const lost = await list.execute({ limit: 10, reportType: 'lost' })

        expect(firstPage.items.map(p => p.toSnapshot().description)).toEqual(['tercero', 'segundo'])
        expect(secondPage.items.map(p => p.toSnapshot().description)).toEqual(['primero'])
        expect(secondPage.nextCursor).toBeNull()
        expect(lost.items).toHaveLength(2)
    })

    it('only lets authorised actors mark a pet as reunited', async () => {
        const pet = await reportPet.execute(data(), anonymous)
        const markAsReunited = new MarkPetAsReunited(repository, { now: () => new Date('2026-10-20T00:00:00Z') })

        await expect(markAsReunited.execute(pet.id, anonymous)).rejects.toThrow(ForbiddenError)
        await markAsReunited.execute(pet.id, admin)

        expect((await repository.findById(pet.id))?.isReunited).toBe(true)
    })

    it('only lets authorised actors delete a pet', async () => {
        const pet = await reportPet.execute(data(), anonymous)
        const deletePet = new DeletePet(repository)

        await expect(deletePet.execute(pet.id, anonymous)).rejects.toThrow(ForbiddenError)
        await deletePet.execute(pet.id, admin)

        expect(await repository.findById(pet.id)).toBeNull()
    })
})
