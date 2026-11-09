import type { ImageStorage, PetRepository, SightingRepository, UploadAuthorization } from './ports'

/**
 * Image URLs are public, so anyone can submit someone else's photo as theirs. Deleting a report or sighting
 * must then never delete an image that another pet or sighting still uses: this wrapper only deletes images
 * nobody references any more (call it after the owning record is gone). Everything else is delegated.
 */
export class SharedImageGuard implements ImageStorage {
    constructor(
        private readonly images: ImageStorage,
        private readonly pets: Pick<PetRepository, 'listAllImageUrls'>,
        private readonly sightings: Pick<SightingRepository, 'listAllImageUrls'>
    ) {}

    isManagedUrl(url: string): boolean {
        return this.images.isManagedUrl(url)
    }

    authorizeUpload(): UploadAuthorization {
        return this.images.authorizeUpload()
    }

    previewUrl(url: string, maxSize: number): string {
        return this.images.previewUrl(url, maxSize)
    }

    listUploadedBefore(date: Date): Promise<string[]> {
        return this.images.listUploadedBefore(date)
    }

    imageKey(url: string): string | null {
        return this.images.imageKey(url)
    }

    async delete(urls: string[]): Promise<void> {
        if (urls.length === 0) return
        const used = await this.referencedKeys()
        const unused = urls.filter(url => {
            const key = this.images.imageKey(url)
            return key !== null && !used.has(key)
        })
        if (unused.length > 0) await this.images.delete(unused)
    }

    /** The URLs among `urls` that some pet or sighting already uses. */
    async alreadyUsed(urls: string[]): Promise<string[]> {
        if (urls.length === 0) return []
        const used = await this.referencedKeys()
        return urls.filter(url => {
            const key = this.images.imageKey(url)
            return key !== null && used.has(key)
        })
    }

    private async referencedKeys(): Promise<Set<string>> {
        const [petImages, sightingImages] = await Promise.all([
            this.pets.listAllImageUrls(),
            this.sightings.listAllImageUrls()
        ])
        return new Set([...petImages, ...sightingImages].flatMap(url => this.images.imageKey(url) ?? []))
    }
}
