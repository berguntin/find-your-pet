import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '../../../shared/domain/actor'
import { ContentRejectedError, ForbiddenError, NotFoundError, ValidationError } from '../../../shared/domain/errors'
import type { ModerationScores } from '../domain/moderation'
import type { ReportPetData } from '../domain/Pet'
import { createPetsModule, type PetsModule } from '../index'
import { InMemoryImageStorage } from '../infrastructure/InMemoryImageStorage'
import { InMemoryPetRepository } from '../infrastructure/InMemoryPetRepository'
import type { ContentModerator } from './ports'

const anonymous: Actor = { kind: 'anonymous' }
const admin: Actor = { kind: 'admin' }

const APPROVE: ModerationScores = { isPetReport: 0.95, showsAnimal: 0.9, inappropriate: 0.01 }
const REVIEW: ModerationScores = { isPetReport: 0.5, showsAnimal: 0.9, inappropriate: 0.01 }
const REJECT: ModerationScores = { isPetReport: 0.05, showsAnimal: 0.1, inappropriate: 0.01 }

describe('pet use cases', () => {
    let repository: InMemoryPetRepository
    let images: InMemoryImageStorage
    let moderator: { review: ReturnType<typeof vi.fn<ContentModerator['review']>> }
    let reportError: ReturnType<typeof vi.fn>
    let pets: PetsModule
    let now: Date

    const data = (overrides: Partial<ReportPetData> = {}): ReportPetData => ({
        reportType: 'lost',
        species: 'cat',
        description: 'Gata blanca',
        location: 'Valencia',
        contact: 'ana@example.com',
        eventDate: '2026-10-01',
        ...overrides,
        images: overrides.images ?? [images.upload(`${Math.random()}.jpg`)]
    })

    const reportApproved = (overrides: Partial<ReportPetData> = {}) => pets.report.execute(data(overrides), anonymous)

    const reportPending = async (overrides: Partial<ReportPetData> = {}) => {
        moderator.review.mockResolvedValueOnce(REVIEW)
        return pets.report.execute(data(overrides), anonymous)
    }

    beforeEach(() => {
        repository = new InMemoryPetRepository()
        images = new InMemoryImageStorage()
        moderator = { review: vi.fn<ContentModerator['review']>().mockResolvedValue(APPROVE) }
        reportError = vi.fn()
        let seconds = 0
        let counter = 0
        now = new Date('2026-10-19T10:00:00Z')
        pets = createPetsModule({
            pets: repository,
            images,
            describer: { describe: vi.fn().mockResolvedValue(null) },
            moderator,
            clock: { now: () => new Date(now.getTime() + 1000 * seconds++) },
            ids: { next: () => `pet-${++counter}` },
            reportError
        })
    })

    describe('ReportPet', () => {
        it('publishes an approved report and records the event', async () => {
            const pet = await reportApproved()

            expect(pet.isPublic).toBe(true)
            expect(await repository.findById(pet.id)).not.toBeNull()
            expect(repository.outbox.pending().map(e => [e.type, e.payload])).toEqual([
                ['pet.published', { petId: pet.id }]
            ])
        })

        it('sends the cleaned-up text and small previews of the images to the moderator', async () => {
            const report = data({ name: '  Nieve ', images: [images.upload('a.jpg'), images.upload('b.jpg')] })
            await pets.report.execute(report, anonymous)

            expect(moderator.review).toHaveBeenCalledWith({
                reportType: 'lost',
                species: 'cat',
                name: 'Nieve',
                description: 'Gata blanca',
                location: 'Valencia',
                contact: 'ana@example.com',
                images: ['https://storage.test/pets/preview-768/a.jpg', 'https://storage.test/pets/preview-768/b.jpg']
            })
        })

        it('stores uncertain reports hidden and without events', async () => {
            const pet = await reportPending()

            expect(pet.toSnapshot()).toMatchObject({ moderationStatus: 'pending_review', moderationScores: REVIEW })
            expect(repository.outbox.pending()).toEqual([])
        })

        it('rejects inappropriate reports without storing them and deletes their images', async () => {
            moderator.review.mockResolvedValueOnce(REJECT)
            const report = data()

            await expect(pets.report.execute(report, anonymous)).rejects.toThrow(ContentRejectedError)
            expect((await repository.search({ limit: 10 })).items).toEqual([])
            expect(images.deleted).toEqual(report.images)
        })

        it('still rejects when deleting the images fails, and reports the error', async () => {
            moderator.review.mockResolvedValueOnce(REJECT)
            images.failOnDelete = true

            await expect(pets.report.execute(data(), anonymous)).rejects.toThrow(ContentRejectedError)
            expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'delete-images')
        })

        it('sends the report to review when the moderator fails', async () => {
            moderator.review.mockRejectedValueOnce(new Error('timeout'))

            const pet = await pets.report.execute(data(), anonymous)

            expect(pet.toSnapshot()).toMatchObject({ moderationStatus: 'pending_review', moderationScores: null })
            expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'moderation')
        })

        it('validates the report before paying for moderation', async () => {
            await expect(pets.report.execute(data({ description: ' ' }), anonymous)).rejects.toThrow(ValidationError)
            expect(moderator.review).not.toHaveBeenCalled()
        })

        it('rejects images that were not uploaded through the app', async () => {
            await expect(pets.report.execute(data({ images: ['https://evil.test/x.jpg'] }), anonymous)).rejects.toThrow(
                ValidationError
            )
            expect(moderator.review).not.toHaveBeenCalled()
        })

        it('assigns the owner when a user reports', async () => {
            const pet = await pets.report.execute(data(), { kind: 'user', userId: 'user-1' })

            expect(pet.toSnapshot().ownerId).toBe('user-1')
        })
    })

    describe('visibility', () => {
        it('lists only approved pets, newest first, with pagination', async () => {
            await reportApproved({ description: 'primero' })
            await reportPending({ description: 'oculto' })
            await reportApproved({ reportType: 'found', description: 'segundo' })
            await reportApproved({ description: 'tercero' })

            const first = await pets.list.execute({ limit: 2 })
            const second = await pets.list.execute({ limit: 2, cursor: first.nextCursor! })
            const lost = await pets.list.execute({ limit: 10, reportType: 'lost' })

            expect(first.items.map(p => p.toSnapshot().description)).toEqual(['tercero', 'segundo'])
            expect(second.items.map(p => p.toSnapshot().description)).toEqual(['primero'])
            expect(lost.items).toHaveLength(2)
        })

        it('hides pending pets from the public but not from admins', async () => {
            const pet = await reportPending()

            await expect(pets.get.execute(pet.id, anonymous)).rejects.toThrow(NotFoundError)
            expect((await pets.get.execute(pet.id, admin)).id).toBe(pet.id)
        })

        it('shows pending pets to their owner', async () => {
            moderator.review.mockResolvedValueOnce(REVIEW)
            const pet = await pets.report.execute(data(), { kind: 'user', userId: 'user-1' })

            expect((await pets.get.execute(pet.id, { kind: 'user', userId: 'user-1' })).id).toBe(pet.id)
        })

        it('fails with NotFound for unknown pets', async () => {
            await expect(pets.get.execute('missing', admin)).rejects.toThrow(NotFoundError)
        })

        it('lists pending pets for admins only', async () => {
            await reportApproved()
            const pending = await reportPending()

            await expect(pets.listForModeration.execute({ limit: 10 }, anonymous)).rejects.toThrow(ForbiddenError)
            const page = await pets.listForModeration.execute({ limit: 10 }, admin)
            const approved = await pets.listForModeration.execute({ limit: 10, moderationStatus: 'approved' }, admin)

            expect(page.items.map(p => p.id)).toEqual([pending.id])
            expect(approved.items).toHaveLength(1)
        })
    })

    describe('ModeratePet', () => {
        it('lets an admin publish a pending pet', async () => {
            const pet = await reportPending()

            const approved = await pets.moderate.execute(pet.id, 'approved', admin)

            expect(approved?.isPublic).toBe(true)
            expect(repository.outbox.pending().map(e => e.type)).toEqual(['pet.published'])
        })

        it('deletes a rejected pet and its images', async () => {
            const pet = await reportPending()

            expect(await pets.moderate.execute(pet.id, 'rejected', admin)).toBeNull()
            expect(await repository.findById(pet.id)).toBeNull()
            expect(images.deleted).toEqual(pet.toSnapshot().images)
        })

        it('is admin only', async () => {
            const pet = await reportPending()

            await expect(pets.moderate.execute(pet.id, 'approved', anonymous)).rejects.toThrow(ForbiddenError)
        })
    })

    describe('managing pets', () => {
        it('only lets authorised actors mark a pet as reunited, recording the event', async () => {
            const pet = await reportApproved()
            await repository.outbox.complete(repository.outbox.pending()[0]!.id, now)

            await expect(pets.markAsReunited.execute(pet.id, anonymous)).rejects.toThrow(ForbiddenError)
            await pets.markAsReunited.execute(pet.id, admin)

            expect((await repository.findById(pet.id))?.isReunited).toBe(true)
            expect(repository.outbox.pending().map(e => e.type)).toEqual(['pet.reunited'])
        })

        it('only lets authorised actors delete a pet, and deletes its images', async () => {
            const pet = await reportApproved()

            await expect(pets.delete.execute(pet.id, anonymous)).rejects.toThrow(ForbiddenError)
            await pets.delete.execute(pet.id, admin)

            expect(await repository.findById(pet.id)).toBeNull()
            expect(images.deleted).toEqual(pet.toSnapshot().images)
        })
    })

    describe('CleanUpOrphanImages', () => {
        it('deletes old uploads no pet references', async () => {
            const longAgo = new Date('2026-10-01T00:00:00Z')
            const used = images.upload('used.jpg', longAgo)
            const orphan = images.upload('orphan.jpg', longAgo)
            const recent = images.upload('recent.jpg', new Date('2026-10-19T09:00:00Z'))
            await pets.report.execute(data({ images: [used] }), anonymous)

            expect(await pets.cleanUpOrphanImages.execute()).toEqual({ deleted: 1 })
            expect(images.deleted).toEqual([orphan])
            expect(images.uploaded.has(recent)).toBe(true)
        })

        it('matches images by key, not by exact URL', async () => {
            const longAgo = new Date('2026-10-01T00:00:00Z')
            const stored = images.upload('photo.jpg', longAgo)
            const referencedAsPreview = images.previewUrl(stored, 300)
            await pets.report.execute(data({ images: [referencedAsPreview] }), anonymous)

            expect(await pets.cleanUpOrphanImages.execute()).toEqual({ deleted: 0 })
        })

        it('caps the deletions per run', async () => {
            const longAgo = new Date('2026-10-01T00:00:00Z')
            for (let i = 0; i < 5; i++) images.upload(`orphan-${i}.jpg`, longAgo)

            expect(await pets.cleanUpOrphanImages.execute({ maxDeletions: 2 })).toEqual({ deleted: 2 })
        })
    })
})
