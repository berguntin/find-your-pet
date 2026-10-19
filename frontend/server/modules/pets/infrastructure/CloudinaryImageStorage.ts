import { v2 as cloudinary } from 'cloudinary'
import type { Clock } from '../../../shared/application/ports'
import type { ImageStorage, UploadAuthorization } from '../application/ports'

export interface CloudinaryOptions {
    cloudName: string
    apiKey: string
    apiSecret: string
    folder: string
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

    isManagedUrl(url: string): boolean {
        const prefix = `https://res.cloudinary.com/${this.options.cloudName}/image/upload/`
        return url.startsWith(prefix) && url.slice(prefix.length).split('/').includes(this.options.folder)
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
}
