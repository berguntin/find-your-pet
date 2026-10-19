import { v2 as cloudinary } from 'cloudinary'
import type { Clock } from '../../../shared/application/ports'
import type { ImageStorage, UploadAuthorization } from '../application/ports'

export interface CloudinaryOptions {
    cloudName: string
    apiKey: string
    apiSecret: string
    folder: string
}

/** Cloudinary's Admin API deletes at most 100 resources per call. */
const DELETE_BATCH_SIZE = 100

interface CloudinaryResource {
    secure_url: string
    created_at: string
}

/**
 * The browser uploads straight to Cloudinary with a short-lived signature, so images never go
 * through our serverless functions (Vercel caps request bodies at 4.5 MB).
 */
export class CloudinaryImageStorage implements ImageStorage {
    constructor(
        private readonly options: CloudinaryOptions,
        private readonly clock: Clock
    ) {}

    private get deliveryPrefix(): string {
        return `https://res.cloudinary.com/${this.options.cloudName}/image/upload/`
    }

    private get credentials() {
        return {
            cloud_name: this.options.cloudName,
            api_key: this.options.apiKey,
            api_secret: this.options.apiSecret
        }
    }

    isManagedUrl(url: string): boolean {
        return this.imageKey(url) !== null
    }

    /** The public id (`pets/abc123`), which ignores transformations, version and format in the URL. */
    imageKey(url: string): string | null {
        if (!url.startsWith(this.deliveryPrefix)) return null
        const segments = url.slice(this.deliveryPrefix.length).split('/').filter(Boolean)
        const folderIndex = segments.indexOf(this.options.folder)
        if (folderIndex === -1 || folderIndex === segments.length - 1) return null

        return segments.slice(folderIndex).join('/').replace(/\.[a-z0-9]+$/i, '')
    }

    previewUrl(url: string, maxSize: number): string {
        if (!this.isManagedUrl(url)) return url
        return url.replace(this.deliveryPrefix, `${this.deliveryPrefix}c_limit,w_${maxSize},h_${maxSize}/`)
    }

    authorizeUpload(): UploadAuthorization {
        // Every parameter here is covered by the signature, so the browser cannot change them.
        const params = {
            folder: this.options.folder,
            timestamp: String(Math.round(this.clock.now().getTime() / 1000)),
            allowed_formats: 'jpg,jpeg,png,webp,heic,heif',
            transformation: 'c_limit,w_1600,h_1600'
        }
        const signature = cloudinary.utils.api_sign_request(params, this.options.apiSecret)

        return {
            uploadUrl: `https://api.cloudinary.com/v1_1/${this.options.cloudName}/image/upload`,
            fields: { ...params, api_key: this.options.apiKey, signature }
        }
    }

    async delete(urls: string[]): Promise<void> {
        const publicIds = [...new Set(urls.map(url => this.imageKey(url)).filter(id => id !== null))]
        for (let i = 0; i < publicIds.length; i += DELETE_BATCH_SIZE) {
            await cloudinary.api.delete_resources(publicIds.slice(i, i + DELETE_BATCH_SIZE), this.credentials)
        }
    }

    async listUploadedBefore(date: Date): Promise<string[]> {
        const urls: string[] = []
        let cursor: string | undefined
        do {
            const page: { resources: CloudinaryResource[]; next_cursor?: string } = await cloudinary.api.resources({
                ...this.credentials,
                type: 'upload',
                resource_type: 'image',
                prefix: `${this.options.folder}/`,
                max_results: 500,
                next_cursor: cursor
            })
            urls.push(...page.resources.filter(r => new Date(r.created_at) < date).map(r => r.secure_url))
            cursor = page.next_cursor
        } while (cursor)
        return urls
    }
}
