import { describe, expect, it } from 'vitest'
import { InMemoryImageStorage } from '../infrastructure/InMemoryImageStorage'
import { SharedImageGuard } from './sharedImages'

describe('SharedImageGuard', () => {
    const setup = (petImages: string[], sightingImages: string[] = []) => {
        const storage = new InMemoryImageStorage()
        const guard = new SharedImageGuard(
            storage,
            { listAllImageUrls: async () => petImages },
            { listAllImageUrls: async () => sightingImages }
        )
        return { storage, guard }
    }

    it('only deletes images no pet or sighting uses, whatever the URL transformation', async () => {
        const storage = new InMemoryImageStorage()
        const used = storage.upload('used.jpg')
        const free = storage.upload('free.jpg')
        const guard = new SharedImageGuard(
            storage,
            { listAllImageUrls: async () => [used] },
            { listAllImageUrls: async () => [] }
        )

        await guard.delete([storage.previewUrl(used, 768), free, 'https://evil.test/x.jpg'])
        await guard.delete([])

        expect(storage.deleted).toEqual([free])
    })

    it('tells which URLs are already used by pets or sightings', async () => {
        const storage = new InMemoryImageStorage()
        const pet = storage.upload('pet.jpg')
        const sighting = storage.upload('sighting.jpg')
        const fresh = storage.upload('fresh.jpg')
        const guard = new SharedImageGuard(
            storage,
            { listAllImageUrls: async () => [pet] },
            { listAllImageUrls: async () => [sighting] }
        )

        expect(await guard.alreadyUsed([pet, sighting, fresh])).toEqual([pet, sighting])
        expect(await guard.alreadyUsed([])).toEqual([])
    })

    it('delegates everything else to the storage', async () => {
        const { storage, guard } = setup([])
        const url = storage.upload('a.jpg')

        expect(guard.isManagedUrl(url)).toBe(true)
        expect(guard.imageKey(url)).toBe('a.jpg')
        expect(guard.previewUrl(url, 100)).toBe(storage.previewUrl(url, 100))
        expect(guard.authorizeUpload()).toEqual(storage.authorizeUpload())
        expect(await guard.listUploadedBefore(new Date())).toEqual([url])
    })
})
