import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReportPetData } from '../domain/Pet'
import { createPetsModule, petsEventHandlers, type PetsModule } from '../index'
import { FakeEmbedder } from '../infrastructure/FakeEmbedder'
import { UnavailableEmbedder } from '../infrastructure/GeminiEmbedder'
import { InMemoryModerationLog } from '../infrastructure/InMemoryModerationLog'
import { InMemoryImageStorage } from '../infrastructure/InMemoryImageStorage'
import { InMemoryPetEmbeddingIndex } from '../infrastructure/InMemoryPetEmbeddingIndex'
import { InMemoryPetRepository } from '../infrastructure/InMemoryPetRepository'
import { petSearchText } from './search'

const APPROVE = { isPetReport: 0.95, showsAnimal: 0.9, inappropriate: 0.01 }
const REVIEW = { isPetReport: 0.5, showsAnimal: 0.9, inappropriate: 0.01 }

// Unit vectors at known angles: cos(a, b) is easy to reason about.
const angle = (degrees: number) => [Math.cos((degrees * Math.PI) / 180), Math.sin((degrees * Math.PI) / 180)]
// Pointing away from every query used in these tests.
const NOWHERE = angle(180)

describe('search', () => {
    let repository: InMemoryPetRepository
    let images: InMemoryImageStorage
    let embedder: FakeEmbedder
    let index: InMemoryPetEmbeddingIndex
    let moderation: typeof APPROVE
    let reportError: ReturnType<typeof vi.fn>
    let pets: PetsModule

    const preview = (url: string) => images.previewUrl(url, 512)

    let seconds = 0

    const build = (overrides: { embedder?: FakeEmbedder | UnavailableEmbedder } = {}) =>
        createPetsModule({
            pets: repository,
            images,
            describer: { describe: async () => null },
            moderator: { model: 'test-moderator', review: async () => moderation },
            moderationLog: new InMemoryModerationLog(),
            embedder: overrides.embedder ?? embedder,
            embeddingIndex: index,
            // Photo vs photo: cos 1 → 100%, cos 0.9 → 0%, below hidden.
            matchCalibration: { floor: 0.9, ceiling: 1 },
            // Text vs text like photos; text vs photo on a lower scale: cos 0.7 → 100%, 0.5 → 0%.
            semanticCalibration: { text: { floor: 0.9, ceiling: 1 }, image: { floor: 0.5, ceiling: 0.7 } },
            // Each call is one second later, so "newest first" is deterministic.
            clock: { now: () => new Date(Date.UTC(2026, 9, 19, 10, 0, seconds++)) },
            ids: { next: () => `pet-${Math.random()}` },
            reportError
        })

    /**
     * Reports a pet whose photos and text embed to the given angles, and indexes it like the outbox would.
     */
    const reportPet = async (vectors: { photos?: number[]; text?: number }, overrides: Partial<ReportPetData> = {}) => {
        const urls = (vectors.photos ?? [180]).map((degrees, i) => {
            const url = images.upload(`${Math.random()}-${i}.jpg`)
            embedder.register(preview(url), angle(degrees))
            return url
        })
        const pet = await pets.report.execute(
            {
                reportType: 'lost',
                species: 'dog',
                description: `Perro ${Math.random()}`,
                location: 'Paiporta',
                contact: '600000000',
                eventDate: '2026-10-01',
                images: urls,
                ...overrides
            },
            { kind: 'anonymous' }
        )
        embedder.register(petSearchText(pet.toSnapshot()), vectors.text === undefined ? NOWHERE : angle(vectors.text))
        await pets.indexForSearch.execute(pet.id)
        return pet
    }

    const searchByPhoto = (degrees: number) => {
        embedder.register('query-photo', angle(degrees))
        return pets.searchByImage.execute({ mimeType: 'image/jpeg', data: Buffer.from('query-photo') })
    }

    beforeEach(() => {
        repository = new InMemoryPetRepository()
        images = new InMemoryImageStorage()
        embedder = new FakeEmbedder()
        index = new InMemoryPetEmbeddingIndex()
        moderation = APPROVE
        reportError = vi.fn()
        pets = build()
    })

    describe('petSearchText', () => {
        it('describes the pet in Spanish with everything a search may refer to', async () => {
            const pet = await reportPet(
                {},
                { reportType: 'found', species: 'cat', name: 'Nala', description: 'Gata negra', location: 'Sedaví' }
            )

            expect(petSearchText(pet.toSnapshot())).toBe('Gato encontrado. Se llama Nala. Gata negra Zona: Sedaví.')
        })

        it('leaves out an unknown name', async () => {
            const pet = await reportPet({}, { description: 'Perro marrón', location: 'Alfafar' })

            expect(petSearchText(pet.toSnapshot())).toBe('Perro perdido. Perro marrón Zona: Alfafar.')
        })
    })

    describe('IndexPetForSearch', () => {
        it('indexes every photo (as small previews) and the report text of a public pet', async () => {
            const pet = await reportPet({ photos: [0, 10], text: 30 })

            const entry = index.entries.get(pet.id)!
            expect(entry.model).toBe('fake-embedder')
            expect(entry.images.map(i => i.imageUrl)).toEqual(pet.toSnapshot().images)
            expect(entry.text).toEqual(angle(30))
            expect(embedder.calls.at(-1)).toEqual([
                ...pet.toSnapshot().images.map(url => ({ kind: 'url', url: preview(url) })),
                { kind: 'text', text: petSearchText(pet.toSnapshot()) }
            ])
        })

        it('is idempotent', async () => {
            const pet = await reportPet({ photos: [0] })
            await pets.indexForSearch.execute(pet.id)

            expect(index.entries.get(pet.id)!.images).toHaveLength(1)
        })

        it('removes pets that are not public or no longer exist', async () => {
            moderation = REVIEW
            const pending = await reportPet({ photos: [0] })
            index.entries.set('gone', { model: 'fake-embedder', images: [], text: angle(0) })

            await pets.indexForSearch.execute('gone')

            expect(index.entries.has(pending.id)).toBe(false)
            expect(index.entries.has('gone')).toBe(false)
        })

        it('runs when a pet is published, through the outbox handlers', async () => {
            const pet = await reportPet({ photos: [0] })
            index.entries.clear()

            await petsEventHandlers(pets)['pet.published']({ payload: { petId: pet.id } })

            expect(index.entries.has(pet.id)).toBe(true)
        })

        it('rejects malformed events so the outbox retries and records them', async () => {
            await expect(petsEventHandlers(pets)['pet.published']({ payload: {} })).rejects.toThrow('petId')
        })
    })

    describe('BackfillSearchIndex', () => {
        it('indexes published pets missing from the index, so photo search finds them', async () => {
            const missing = await reportPet({ photos: [0] })
            const indexed = await reportPet({ photos: [60] })
            index.entries.delete(missing.id)
            const callsBefore = embedder.calls.length

            expect(await searchByPhoto(0)).toEqual([])
            expect(await pets.backfillSearchIndex.execute()).toEqual({ indexed: 1, failed: 0, remaining: 0 })

            expect(embedder.calls.length).toBe(callsBefore + 2) // the search query and the missing pet only
            expect(index.entries.has(indexed.id)).toBe(true)
            expect((await searchByPhoto(0)).map(r => [r.pet.id, r.match])).toEqual([[missing.id, 100]])
        })

        it('reindexes pets indexed only with another model', async () => {
            const pet = await reportPet({ photos: [0] })
            index.entries.set(pet.id, { ...index.entries.get(pet.id)!, model: 'old-model' })

            expect(await pets.backfillSearchIndex.execute()).toMatchObject({ indexed: 1 })
            expect(index.entries.get(pet.id)!.model).toBe('fake-embedder')
        })

        it('skips pets that are not public', async () => {
            moderation = REVIEW
            const pending = await reportPet({ photos: [0] })

            expect(await pets.backfillSearchIndex.execute()).toEqual({ indexed: 0, failed: 0, remaining: 0 })
            expect(index.entries.has(pending.id)).toBe(false)
        })

        it('caps the pets indexed per run and counts the rest', async () => {
            for (let i = 0; i < 3; i++) await reportPet({ photos: [0] })
            index.entries.clear()

            expect(await pets.backfillSearchIndex.execute({ maxPets: 2 })).toEqual({
                indexed: 2,
                failed: 0,
                remaining: 1
            })
            expect(await pets.backfillSearchIndex.execute({ maxPets: 2 })).toEqual({
                indexed: 1,
                failed: 0,
                remaining: 0
            })
        })

        it('reports a pet that cannot be indexed and goes on with the rest', async () => {
            const broken = await reportPet({ photos: [0] })
            const fine = await reportPet({ photos: [0] })
            index.entries.clear()
            embedder.vectors.delete(preview(broken.toSnapshot().images[0]!))

            expect(await pets.backfillSearchIndex.execute()).toEqual({ indexed: 1, failed: 1, remaining: 0 })
            expect(index.entries.has(fine.id)).toBe(true)
            expect(reportError).toHaveBeenCalledWith(expect.any(Error), `search-backfill:${broken.id}`)
        })

        it('does nothing without an embedder', async () => {
            await reportPet({ photos: [0] })
            index.entries.clear()

            pets = build({ embedder: new UnavailableEmbedder() })
            expect(await pets.backfillSearchIndex.execute()).toEqual({ indexed: 0, failed: 0, remaining: 0 })
        })
    })

    describe('SearchPetsByImage', () => {
        it('returns similar pets best first with a calibrated match, hiding dissimilar ones', async () => {
            const same = await reportPet({ photos: [0] })
            const close = await reportPet({ photos: [20] })
            await reportPet({ photos: [60] })

            const results = await searchByPhoto(0)

            expect(results.map(r => [r.pet.id, r.match])).toEqual([
                [same.id, 100],
                [close.id, expect.any(Number)]
            ])
            expect(results[1]!.match).toBeGreaterThan(0)
            expect(results[1]!.match).toBeLessThan(100)
        })

        it('uses the best photo of each pet', async () => {
            const pet = await reportPet({ photos: [90, 1] })

            expect((await searchByPhoto(0)).map(r => r.pet.id)).toEqual([pet.id])
        })

        it('compares photos with photos only, not with report texts', async () => {
            await reportPet({ photos: [90], text: 0 })

            expect(await searchByPhoto(0)).toEqual([])
        })

        it('never returns reunited or hidden pets', async () => {
            const reunited = await reportPet({ photos: [0] })
            await pets.markAsReunited.execute(reunited.id, { kind: 'admin' })
            moderation = REVIEW
            const pending = await reportPet({ photos: [0] })
            // Simulate a stale index entry for the pending pet.
            index.entries.set(pending.id, {
                model: 'fake-embedder',
                images: [{ imageUrl: 'x', vector: angle(0) }],
                text: NOWHERE
            })

            expect(await searchByPhoto(0)).toEqual([])
        })

        it('ignores vectors from another model', async () => {
            const pet = await reportPet({ photos: [0] })
            index.entries.get(pet.id)!.model = 'old-model'

            expect(await searchByPhoto(0)).toEqual([])
        })

        it('sends the photo bytes to the embedder, never stores them', async () => {
            await searchByPhoto(0)

            expect(embedder.calls.at(-1)).toEqual([
                { kind: 'bytes', mimeType: 'image/jpeg', data: Buffer.from('query-photo') }
            ])
            expect(images.uploaded.size).toBe(0)
        })
    })

    describe('SearchPetsByText', () => {
        const searchText = (query: string, degrees: number, filters = {}) => {
            embedder.register(query, angle(degrees))
            return pets.searchByText.execute(query, filters)
        }

        it('finds pets whose report text means the same as the query', async () => {
            const black = await reportPet({ text: 0 })
            await reportPet({ text: 90 })

            const results = await searchText('perro negro', 0)

            expect(results.map(r => [r.pet.id, r.match])).toEqual([[black.id, 100]])
        })

        it('finds pets by their photos too, with the text-to-photo calibration', async () => {
            // The report text says nothing useful, but the photo matches the query (cos 45° ≈ 0.71).
            const pet = await reportPet({ photos: [45] })

            const [result] = await searchText('perro negro', 0)

            expect(result).toMatchObject({ pet: { id: pet.id }, match: 100 })
        })

        it('ranks by the best of text and photo relevance', async () => {
            const byPhoto = await reportPet({ photos: [55] }) // cos ≈ 0.57 → 37%
            const byText = await reportPet({ text: 10 }) // cos ≈ 0.98 → 85%

            const results = await searchText('perro negro', 0)

            expect(results.map(r => r.pet.id)).toEqual([byText.id, byPhoto.id])
            expect(results[1]!.match).toBeLessThan(results[0]!.match)
        })

        it('applies the listing filters', async () => {
            await reportPet({ text: 0 }, { reportType: 'lost' })
            const found = await reportPet({ text: 0 }, { reportType: 'found' })

            expect((await searchText('perro negro', 0, { reportType: 'found' })).map(r => r.pet.id)).toEqual([found.id])
        })

        it('keeps reunited pets, as the listing does, but never hidden ones', async () => {
            const reunited = await reportPet({ text: 0 })
            await pets.markAsReunited.execute(reunited.id, { kind: 'admin' })
            moderation = REVIEW
            const pending = await reportPet({ text: 0 })
            index.entries.set(pending.id, { model: 'fake-embedder', images: [], text: angle(0) })

            expect((await searchText('perro negro', 0)).map(r => r.pet.id)).toEqual([reunited.id])
        })
    })

    describe('SearchPets (listing search)', () => {
        it('lists approved pets newest first without a query', async () => {
            const first = await reportPet({})
            const second = await reportPet({})

            const page = await pets.search.execute({ limit: 10 }, { semantic: true })

            expect(page.items.map(p => p.id)).toEqual([second.id, first.id])
        })

        it('puts keyword hits first, then semantic matches, without duplicates', async () => {
            const semanticOnly = await reportPet({ text: 0 }, { description: 'Mestizo de pelo oscuro' })
            const both = await reportPet({ text: 0 }, { description: 'Perro negro con collar' })
            await reportPet({ text: 90 }, { description: 'Gato blanco' })
            embedder.register('perro negro', angle(0))

            const page = await pets.search.execute({ limit: 10, query: 'perro negro' }, { semantic: true })

            expect(page.items.map(p => p.id)).toEqual([both.id, semanticOnly.id])
            expect(page.nextCursor).toBeNull()
        })

        it.each([
            ['semantic search is off for the request', { semantic: false }, () => embedder],
            ['no embedder is configured', { semantic: true }, () => new UnavailableEmbedder()]
        ])('uses keywords only when %s', async (_, options, getEmbedder) => {
            await reportPet({ text: 0 }, { description: 'Mestizo de pelo oscuro' })
            const keyword = await reportPet({ text: 0 }, { description: 'Perro negro' })
            pets = build({ embedder: getEmbedder() })
            embedder.register('perro negro', angle(0))

            const page = await pets.search.execute({ limit: 10, query: 'perro negro' }, options)

            expect(page.items.map(p => p.id)).toEqual([keyword.id])
        })

        it('falls back to keywords and reports the error when semantic search fails', async () => {
            const keyword = await reportPet({ text: 0 }, { description: 'Perro negro' })
            // No vector registered for the query: the embedder fails.

            const page = await pets.search.execute({ limit: 10, query: 'perro negro' }, { semantic: true })

            expect(page.items.map(p => p.id)).toEqual([keyword.id])
            expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'semantic-search')
        })

        it('keeps keyword pagination for later pages', async () => {
            for (let i = 0; i < 3; i++) await reportPet({}, { description: `Perro negro ${i}` })
            embedder.register('perro negro', angle(0))

            const first = await pets.search.execute({ limit: 2, query: 'perro negro' }, { semantic: false })
            const second = await pets.search.execute(
                { limit: 2, query: 'perro negro', cursor: first.nextCursor! },
                { semantic: true }
            )

            expect(second.items).toHaveLength(1)
        })
    })
})
