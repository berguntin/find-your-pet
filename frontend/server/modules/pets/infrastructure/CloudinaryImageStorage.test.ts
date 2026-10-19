import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CloudinaryImageStorage } from './CloudinaryImageStorage'

const storage = new CloudinaryImageStorage(
    { cloudName: 'my-cloud', apiKey: 'key-123', apiSecret: 'secret-456', folder: 'pets' },
    { now: () => new Date('2026-10-19T10:00:00Z') }
)

describe('CloudinaryImageStorage.isManagedUrl', () => {
    it.each([
        'https://res.cloudinary.com/my-cloud/image/upload/v1/pets/abc.jpg',
        'https://res.cloudinary.com/my-cloud/image/upload/c_limit,w_800/v1/pets/abc.webp'
    ])('accepts images in our folder: %s', url => {
        expect(storage.isManagedUrl(url)).toBe(true)
    })

    it.each([
        ['another cloud', 'https://res.cloudinary.com/other-cloud/image/upload/v1/pets/abc.jpg'],
        ['another folder', 'https://res.cloudinary.com/my-cloud/image/upload/v1/avatars/abc.jpg'],
        ['a folder that only starts like ours', 'https://res.cloudinary.com/my-cloud/image/upload/v1/pets-old/a.jpg'],
        ['plain http', 'http://res.cloudinary.com/my-cloud/image/upload/v1/pets/abc.jpg'],
        ['a lookalike host', 'https://res.cloudinary.com.evil.test/my-cloud/image/upload/v1/pets/abc.jpg'],
        ['a video', 'https://res.cloudinary.com/my-cloud/video/upload/v1/pets/abc.mp4'],
        ['another site', 'https://evil.test/pets/abc.jpg']
    ])('rejects %s', (_, url) => {
        expect(storage.isManagedUrl(url)).toBe(false)
    })
})

describe('CloudinaryImageStorage.authorizeUpload', () => {
    it('signs the upload parameters the way Cloudinary verifies them', () => {
        const { uploadUrl, fields } = storage.authorizeUpload()
        const { api_key, signature, ...signed } = fields

        // Cloudinary's algorithm: sorted key=value pairs joined with &, followed by the secret, hashed with SHA-1.
        const payload = Object.keys(signed)
            .sort()
            .map(key => `${key}=${signed[key]}`)
            .join('&')
        const expected = createHash('sha1').update(`${payload}secret-456`).digest('hex')

        expect(uploadUrl).toBe('https://api.cloudinary.com/v1_1/my-cloud/image/upload')
        expect(api_key).toBe('key-123')
        expect(signature).toBe(expected)
        expect(signed).toEqual({
            folder: 'pets',
            timestamp: String(Date.UTC(2026, 9, 19, 10) / 1000),
            allowed_formats: 'jpg,jpeg,png,webp,heic,heif',
            transformation: 'c_limit,w_1600,h_1600'
        })
    })

    it('never exposes the API secret', () => {
        expect(JSON.stringify(storage.authorizeUpload())).not.toContain('secret-456')
    })
})
