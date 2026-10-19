import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePetsApi } from './usePetsApi'

const $fetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('$fetch', $fetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    $fetch.mockReset()
})

describe('usePetsApi', () => {
    it('lists pets with the query as search params', async () => {
        $fetch.mockResolvedValue({ items: [], nextCursor: null })

        await usePetsApi().list({ reportType: 'lost', q: 'gato' })

        expect($fetch).toHaveBeenCalledWith('/api/v1/pets', { query: { reportType: 'lost', q: 'gato' } })
    })

    it('reports a pet as JSON', async () => {
        const body = { reportType: 'found' } as never
        await usePetsApi().report(body)

        expect($fetch).toHaveBeenCalledWith('/api/v1/pets', { method: 'POST', body })
    })

    it('sends the image to describe', async () => {
        await usePetsApi().describe('data:image/jpeg;base64,AAAA')

        expect($fetch).toHaveBeenCalledWith('/api/v1/pets/describe', {
            method: 'POST',
            body: { image: 'data:image/jpeg;base64,AAAA' }
        })
    })

    it('uploads an image with the signed fields and returns its URL', async () => {
        $fetch
            .mockResolvedValueOnce({ uploadUrl: 'https://upload.test', fields: { signature: 'sig', folder: 'pets' } })
            .mockResolvedValueOnce({ secure_url: 'https://img.test/pets/1.jpg' })
        const image = new Blob(['img'], { type: 'image/jpeg' })

        const url = await usePetsApi().uploadImage(image)

        expect(url).toBe('https://img.test/pets/1.jpg')
        expect($fetch).toHaveBeenNthCalledWith(1, '/api/v1/uploads/signature', { method: 'POST' })
        const [uploadUrl, { method, body }] = $fetch.mock.calls[1]!
        expect([uploadUrl, method]).toEqual(['https://upload.test', 'POST'])
        expect(Object.fromEntries((body as FormData).entries())).toMatchObject({ signature: 'sig', folder: 'pets' })
        expect((body as FormData).get('file')).toBeInstanceOf(Blob)
    })

    it('does not upload when the signature request fails', async () => {
        $fetch.mockRejectedValueOnce(new Error('500'))

        await expect(usePetsApi().uploadImage(new Blob())).rejects.toThrow('500')
        expect($fetch).toHaveBeenCalledTimes(1)
    })
})
