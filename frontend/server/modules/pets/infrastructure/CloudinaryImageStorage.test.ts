import { createHash } from 'node:crypto'
import { v2 as cloudinary } from 'cloudinary'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('CloudinaryImageStorage image keys and previews', () => {
    it('identifies an image by its public id, ignoring transformations, version and format', () => {
        const base = 'https://res.cloudinary.com/my-cloud/image/upload'

        expect(storage.imageKey(`${base}/v1730815307/pets/abc123.jpg`)).toBe('pets/abc123')
        expect(storage.imageKey(`${base}/c_limit,w_768,h_768/v1730815307/pets/abc123.webp`)).toBe('pets/abc123')
        expect(storage.imageKey(`${base}/pets/abc123`)).toBe('pets/abc123')
        expect(storage.imageKey('https://evil.test/pets/abc123.jpg')).toBeNull()
        expect(storage.imageKey(`${base}/v1/pets/`)).toBeNull()
    })

    it('builds a smaller preview URL for managed images only', () => {
        expect(storage.previewUrl('https://res.cloudinary.com/my-cloud/image/upload/v1/pets/a.jpg', 768)).toBe(
            'https://res.cloudinary.com/my-cloud/image/upload/c_limit,w_768,h_768/v1/pets/a.jpg'
        )
        expect(storage.previewUrl('https://evil.test/a.jpg', 768)).toBe('https://evil.test/a.jpg')
    })
})

describe('CloudinaryImageStorage admin calls', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('deletes managed images by public id in batches of 100, with our credentials', async () => {
        const deleteResources = vi.spyOn(cloudinary.api, 'delete_resources').mockResolvedValue({})
        const urls = Array.from(
            { length: 150 },
            (_, i) => `https://res.cloudinary.com/my-cloud/image/upload/v1/pets/img-${i}.jpg`
        )

        await storage.delete([...urls, urls[0]!, 'https://evil.test/pets/x.jpg'])

        expect(deleteResources).toHaveBeenCalledTimes(2)
        const [firstIds, options] = deleteResources.mock.calls[0]!
        expect(firstIds).toHaveLength(100)
        expect(firstIds[0]).toBe('pets/img-0')
        expect(options).toMatchObject({ cloud_name: 'my-cloud', api_key: 'key-123', api_secret: 'secret-456' })
        expect(deleteResources.mock.calls[1]![0]).toHaveLength(50)
    })

    it('does not call Cloudinary when there is nothing to delete', async () => {
        const deleteResources = vi.spyOn(cloudinary.api, 'delete_resources').mockResolvedValue({})

        await storage.delete(['https://evil.test/a.jpg'])

        expect(deleteResources).not.toHaveBeenCalled()
    })

    it('lists every page of uploads in our folder older than a date', async () => {
        const resources = vi
            .spyOn(cloudinary.api, 'resources')
            .mockResolvedValueOnce({
                resources: [
                    { secure_url: 'https://old/1.jpg', created_at: '2026-10-01T00:00:00Z' },
                    { secure_url: 'https://new/2.jpg', created_at: '2026-10-19T09:00:00Z' }
                ],
                next_cursor: 'page-2'
            })
            .mockResolvedValueOnce({
                resources: [{ secure_url: 'https://old/3.jpg', created_at: '2026-10-02T00:00:00Z' }]
            })

        const urls = await storage.listUploadedBefore(new Date('2026-10-18T00:00:00Z'))

        expect(urls).toEqual(['https://old/1.jpg', 'https://old/3.jpg'])
        expect(resources.mock.calls[0]![0]).toMatchObject({ prefix: 'pets/', type: 'upload', api_key: 'key-123' })
        expect(resources.mock.calls[1]![0]).toMatchObject({ next_cursor: 'page-2' })
    })
})
