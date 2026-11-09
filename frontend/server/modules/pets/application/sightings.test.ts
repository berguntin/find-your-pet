import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Actor } from '../../../shared/domain/actor'
import {
    ConflictError,
    ContentRejectedError,
    ForbiddenError,
    NotFoundError,
    ValidationError
} from '../../../shared/domain/errors'
import type { ModerationScores } from '../domain/moderation'
import type { Pet } from '../domain/Pet'
import type { ReportSightingData } from '../domain/Sighting'
import { createPetsModule, type PetsModule } from '../index'
import { FakeEmbedder } from '../infrastructure/FakeEmbedder'
import { InMemoryImageStorage } from '../infrastructure/InMemoryImageStorage'
import { InMemoryModerationLog } from '../infrastructure/InMemoryModerationLog'
import { InMemoryPetEmbeddingIndex } from '../infrastructure/InMemoryPetEmbeddingIndex'
import { InMemoryPetRepository } from '../infrastructure/InMemoryPetRepository'
import { InMemorySightingRepository } from '../infrastructure/InMemorySightingRepository'
import { StaleSightingError, type ContentModerator } from './ports'

const APPROVE: ModerationScores = { isPetReport: 0.95, showsAnimal: 0.9, inappropriate: 0.01 }
const REVIEW: ModerationScores = { isPetReport: 0.5, showsAnimal: 0.9, inappropriate: 0.01 }
const REJECT: ModerationScores = { isPetReport: 0.05, showsAnimal: 0.1, inappropriate: 0.01 }

const user = (userId: string): Actor => ({ kind: 'user', userId })
const admin: Actor = { kind: 'admin' }
const anonymous: Actor = { kind: 'anonymous' }

describe('sighting use cases', () => {
    let petRepository: InMemoryPetRepository
    let sightings: InMemorySightingRepository
    let images: InMemoryImageStorage
    let moderator: { model: string | null; review: ReturnType<typeof vi.fn<ContentModerator['review']>> }
    let moderationLog: InMemoryModerationLog
    let reportError: ReturnType<typeof vi.fn>
    let module: PetsModule
    let pet: Pet

    const data = (overrides: Partial<ReportSightingData> = {}): ReportSightingData => ({
        description: 'Lo he visto junto a la estación',
        area: 'Paiporta',
        seenAt: new Date('2026-11-08T09:00:00Z'),
        ...overrides
    })

    const publishedSighting = (author = 'author') => module.reportSighting.execute(pet.id, data(), user(author))

    beforeEach(async () => {
        petRepository = new InMemoryPetRepository()
        sightings = new InMemorySightingRepository()
        images = new InMemoryImageStorage()
        moderator = { model: 'test-moderator', review: vi.fn<ContentModerator['review']>().mockResolvedValue(APPROVE) }
        moderationLog = new InMemoryModerationLog()
        reportError = vi.fn()
        let seconds = 0
        let counter = 0
        module = createPetsModule({
            pets: petRepository,
            sightings,
            authors: { displayNames: async ids => new Map(ids.filter(id => id !== 'gone').map(id => [id, `${id}!`])) },
            images,
            describer: { describe: vi.fn().mockResolvedValue(null) },
            moderator,
            moderationLog,
            embedder: new FakeEmbedder(),
            embeddingIndex: new InMemoryPetEmbeddingIndex(),
            clock: { now: () => new Date(Date.UTC(2026, 10, 8, 12, 0, seconds++)) },
            ids: { next: () => `id-${++counter}` },
            reportError
        })
        pet = await module.report.execute(
            {
                reportType: 'lost',
                species: 'dog',
                description: 'Perro negro',
                location: 'Paiporta',
                contact: '600000000',
                eventDate: '2026-11-01',
                images: [images.upload('pet.jpg')]
            },
            user('owner')
        )
    })

    describe('ReportSighting', () => {
        it('publishes an approved sighting, moderated as a sighting, and logs the decision', async () => {
            const photo = images.upload('seen.jpg')
            const sighting = await module.reportSighting.execute(pet.id, data({ images: [photo] }), user('ana'))

            expect(sighting.isPublic).toBe(true)
            expect(await sightings.findById(sighting.id)).not.toBeNull()
            expect(moderator.review).toHaveBeenLastCalledWith(
                expect.objectContaining({ kind: 'sighting', reportType: 'lost', species: 'dog', contact: '' })
            )
            expect((await moderationLog.recent(1))[0]).toMatchObject({
                petId: pet.id,
                sightingId: sighting.id,
                decision: 'approved',
                submission: { location: 'Paiporta', name: null }
            })
            expect(sightings.outbox.pending().map(event => event.type)).toEqual(['sighting.published'])
        })

        it('always sends sightings with contact details or money talk to review', async () => {
            const scam = await module.reportSighting.execute(
                pet.id,
                data({ description: 'Lo tengo yo, hazme un bizum de 50 € y te lo devuelvo' }),
                user('ana')
            )

            expect(scam.isPublic).toBe(false)
            expect((await moderationLog.recent(1))[0]).toMatchObject({ decision: 'pending_review' })
        })

        it('approves sightings without photos on the text alone', async () => {
            moderator.review.mockResolvedValueOnce({ ...APPROVE, showsAnimal: 0.01 })

            expect((await publishedSighting()).isPublic).toBe(true)
        })

        it('keeps uncertain sightings for review, and when the moderator fails', async () => {
            moderator.review.mockResolvedValueOnce(REVIEW)
            expect((await publishedSighting()).isPublic).toBe(false)

            moderator.review.mockRejectedValueOnce(new Error('timeout'))
            expect((await publishedSighting()).isPublic).toBe(false)
            expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'moderation')
            expect((await moderationLog.recent(1))[0]).toMatchObject({ error: 'timeout', scores: null })
        })

        it('rejects spam without storing it and deletes its photos', async () => {
            moderator.review.mockResolvedValueOnce(REJECT)
            const photo = images.upload('spam.jpg')

            await expect(module.reportSighting.execute(pet.id, data({ images: [photo] }), user('ana'))).rejects.toThrow(
                ContentRejectedError
            )
            expect(await sightings.listByPet(pet.id, { includeAll: true, limit: 10 })).toEqual([])
            expect(images.deleted).toEqual([photo])
            expect((await moderationLog.recent(1))[0]).toMatchObject({ petId: pet.id, decision: 'rejected' })
            expect((await moderationLog.recent(1))[0]!.sightingId).not.toBeNull()
        })

        it('needs an account, a published open pet and our own images', async () => {
            await expect(module.reportSighting.execute(pet.id, data(), anonymous)).rejects.toThrow(ForbiddenError)
            await expect(module.reportSighting.execute('missing', data(), user('ana'))).rejects.toThrow(NotFoundError)
            await expect(
                module.reportSighting.execute(pet.id, data({ images: ['https://evil.test/a.jpg'] }), user('ana'))
            ).rejects.toThrow(ValidationError)

            await module.markAsReunited.execute(pet.id, user('owner'))
            await expect(module.reportSighting.execute(pet.id, data(), user('ana'))).rejects.toThrow(ConflictError)
        })

        it('does not accept sightings of pets waiting for review', async () => {
            moderator.review.mockResolvedValueOnce(REVIEW)
            const pending = await module.report.execute(
                { ...pet.toSnapshot(), images: [images.upload('p.jpg')] },
                anonymous
            )

            await expect(module.reportSighting.execute(pending.id, data(), user('ana'))).rejects.toThrow(NotFoundError)
        })
    })

    describe('ListSightings', () => {
        it('shows published sightings plus the viewer’s own pending ones, with first names', async () => {
            const published = await publishedSighting('ana')
            moderator.review.mockResolvedValueOnce(REVIEW)
            const pendingOwn = await publishedSighting('luis')
            moderator.review.mockResolvedValueOnce(REVIEW)
            await publishedSighting('marta')

            const { items: forLuis, viewerIsPetOwner } = await module.listSightings.execute(pet.id, user('luis'))
            expect(viewerIsPetOwner).toBe(false)
            expect(forLuis.map(view => view.sighting.id).sort()).toEqual([published.id, pendingOwn.id].sort())
            const ana = forLuis.find(view => view.sighting.id === published.id)!
            expect(ana.authorName).toBe('ana!')
            expect(ana.viewer).toEqual({ isAuthor: false, hasValidated: false, canValidate: true, canHide: false })

            expect((await module.listSightings.execute(pet.id, anonymous)).items).toHaveLength(1)
            expect((await module.listSightings.execute(pet.id, user('owner'))).viewerIsPetOwner).toBe(true)
            expect((await module.listSightings.execute(pet.id, admin)).items).toHaveLength(3)
        })

        it('shows deleted authors as anonymous', async () => {
            await publishedSighting('gone')

            const [view] = (await module.listSightings.execute(pet.id, anonymous)).items
            expect(view!.authorName).toBeNull()
        })

        it('stops offering validation once the pet is reunited', async () => {
            await publishedSighting('ana')
            await module.markAsReunited.execute(pet.id, user('owner'))

            const [view] = (await module.listSightings.execute(pet.id, user('luis'))).items
            expect(view!.viewer.canValidate).toBe(false)
        })

        it('hides sightings of pets nobody may see', async () => {
            await expect(module.listSightings.execute('missing', anonymous)).rejects.toThrow(NotFoundError)
        })
    })

    describe('ValidateSighting', () => {
        it('verifies with the owner alone, or with three people', async () => {
            const byOwner = await publishedSighting()
            expect((await module.validateSighting.execute(byOwner.id, user('owner'))).isVerified).toBe(true)

            const byCommunity = await publishedSighting()
            for (const id of ['a', 'b']) await module.validateSighting.execute(byCommunity.id, user(id))
            expect((await sightings.findById(byCommunity.id))!.isVerified).toBe(false)
            const verified = await module.validateSighting.execute(byCommunity.id, user('c'))
            expect(verified.toSnapshot().verifiedBy).toBe('community')
        })

        it('retries when someone else validated at the same time', async () => {
            const sighting = await publishedSighting()
            await module.validateSighting.execute(sighting.id, user('a'))
            const save = sightings.save.bind(sightings)
            const spy = vi.spyOn(sightings, 'save')
            // Another request saves first: ours is stale and must be applied on top of it.
            spy.mockImplementationOnce(async loaded => {
                await module.validateSighting.execute(sighting.id, user('b'))
                spy.mockImplementation(save)
                return save(loaded)
            })

            const result = await module.validateSighting.execute(sighting.id, user('c'))

            expect(result.isVerified).toBe(true)
            expect((await sightings.findById(sighting.id))!.points).toBe(3)
        })

        it('gives up after repeated conflicts', async () => {
            const sighting = await publishedSighting()
            vi.spyOn(sightings, 'save').mockRejectedValue(new StaleSightingError())

            await expect(module.validateSighting.execute(sighting.id, user('a'))).rejects.toThrow(StaleSightingError)
        })

        it('needs an account, a published sighting and an open pet', async () => {
            const sighting = await publishedSighting()
            await expect(module.validateSighting.execute(sighting.id, anonymous)).rejects.toThrow(ForbiddenError)
            await expect(module.validateSighting.execute('missing', user('a'))).rejects.toThrow(NotFoundError)

            moderator.review.mockResolvedValueOnce(REVIEW)
            const pending = await publishedSighting()
            await expect(module.validateSighting.execute(pending.id, user('a'))).rejects.toThrow(NotFoundError)

            await module.markAsReunited.execute(pet.id, user('owner'))
            await expect(module.validateSighting.execute(sighting.id, user('a'))).rejects.toThrow(ConflictError)
        })

        it('treats sightings of pets hidden later as missing', async () => {
            const sighting = await publishedSighting()
            await module.moderate.execute(pet.id, 'pending_review', admin)

            await expect(module.validateSighting.execute(sighting.id, user('a'))).rejects.toThrow(NotFoundError)
        })
    })

    describe('DeleteSighting', () => {
        it('lets the author delete it with its photos', async () => {
            const photo = images.upload('seen.jpg')
            const sighting = await module.reportSighting.execute(pet.id, data({ images: [photo] }), user('ana'))

            await expect(module.deleteSighting.execute(sighting.id, user('luis'))).rejects.toThrow(ForbiddenError)
            await module.deleteSighting.execute(sighting.id, user('ana'))

            expect(await sightings.findById(sighting.id)).toBeNull()
            expect(images.deleted).toEqual([photo])
        })

        it('hides pending sightings from everyone but the author and admins', async () => {
            moderator.review.mockResolvedValueOnce(REVIEW)
            const sighting = await publishedSighting('ana')

            await expect(module.deleteSighting.execute(sighting.id, user('luis'))).rejects.toThrow(NotFoundError)
            await module.deleteSighting.execute(sighting.id, admin)
            await expect(module.deleteSighting.execute(sighting.id, admin)).rejects.toThrow(NotFoundError)
        })
    })

    describe('moderation by admins', () => {
        it('lists pending sightings and publishes, hides or rejects them, logging each decision', async () => {
            moderator.review.mockResolvedValue(REVIEW)
            const first = await publishedSighting()
            const second = await publishedSighting()

            await expect(module.listSightingsForModeration.execute('pending_review', user('a'))).rejects.toThrow(
                ForbiddenError
            )
            expect((await module.listSightingsForModeration.execute('pending_review', admin)).map(s => s.id)).toEqual([
                second.id,
                first.id
            ])

            expect((await module.moderateSighting.execute(first.id, 'approved', admin))!.isPublic).toBe(true)
            expect((await module.moderateSighting.execute(first.id, 'pending_review', admin))!.isPublic).toBe(false)
            expect(await module.moderateSighting.execute(second.id, 'rejected', admin)).toBeNull()
            expect(await sightings.findById(second.id)).toBeNull()
            expect((await moderationLog.recent(1))[0]).toMatchObject({
                source: 'admin',
                decision: 'rejected',
                sightingId: second.id
            })

            await expect(module.moderateSighting.execute(first.id, 'approved', user('a'))).rejects.toThrow(
                ForbiddenError
            )
            await expect(module.moderateSighting.execute('missing', 'approved', admin)).rejects.toThrow(NotFoundError)
        })
    })

    it('refuses reports reusing photos of other pets', async () => {
        await expect(module.report.execute({ ...pet.toSnapshot() }, anonymous)).rejects.toThrow(ValidationError)
        expect(images.deleted).toEqual([])
    })

    it('refuses photos that a pet or sighting already uses', async () => {
        await expect(
            module.reportSighting.execute(pet.id, data({ images: pet.toSnapshot().images }), user('ana'))
        ).rejects.toThrow(ValidationError)
    })

    it('keeps images used by sightings out of the orphan cleanup', async () => {
        const photo = images.upload('seen.jpg')
        await module.reportSighting.execute(pet.id, data({ images: [photo] }), user('ana'))
        const orphan = images.upload('orphan.jpg')

        await module.cleanUpOrphanImages.execute()

        expect(images.deleted).toEqual([orphan])
    })
})
