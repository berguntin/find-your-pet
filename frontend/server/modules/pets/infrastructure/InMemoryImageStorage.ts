import type { ImageStorage, UploadAuthorization } from '../application/ports'

export const IN_MEMORY_IMAGE_BASE = 'https://storage.test/pets/'

/** Test double: images are URLs under IN_MEMORY_IMAGE_BASE, "uploaded" with `upload()`. */
export class InMemoryImageStorage implements ImageStorage {
    readonly uploaded = new Map<string, Date>()
    readonly deleted: string[] = []
    failOnDelete = false

    upload(name: string, at = new Date(0)): string {
        const url = `${IN_MEMORY_IMAGE_BASE}${name}`
        this.uploaded.set(url, at)
        return url
    }

    isManagedUrl(url: string): boolean {
        return this.imageKey(url) !== null
    }

    imageKey(url: string): string | null {
        if (!url.startsWith(IN_MEMORY_IMAGE_BASE)) return null
        return url.slice(IN_MEMORY_IMAGE_BASE.length).replace(/^preview-\d+\//, '')
    }

    previewUrl(url: string, maxSize: number): string {
        return url.replace(IN_MEMORY_IMAGE_BASE, `${IN_MEMORY_IMAGE_BASE}preview-${maxSize}/`)
    }

    authorizeUpload(): UploadAuthorization {
        return { uploadUrl: 'https://storage.test/upload', fields: { signature: 'sig' } }
    }

    async delete(urls: string[]): Promise<void> {
        if (this.failOnDelete) throw new Error('storage unavailable')
        for (const url of urls) {
            this.uploaded.delete(url)
            this.deleted.push(url)
        }
    }

    async listUploadedBefore(date: Date): Promise<string[]> {
        return [...this.uploaded].filter(([, at]) => at < date).map(([url]) => url)
    }
}
