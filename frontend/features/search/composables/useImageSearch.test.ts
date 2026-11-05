import { FetchError } from 'ofetch'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { PetDto } from '../../../contracts/pets'
import { apiErrorCode } from '../../pets/utils/apiError'
import { useImageSearch } from './useImageSearch'

const searchByImage = vi.fn()

beforeEach(() => {
    // Auto-imported in Nuxt; in tests the composable resolves them as globals.
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
    vi.stubGlobal('usePetsApi', () => ({ searchByImage }))
    vi.stubGlobal('resizeImage', async (file: Blob) => file)
    vi.stubGlobal('blobToDataUrl', async () => 'data:image/jpeg;base64,eA==')
    vi.stubGlobal('apiErrorCode', apiErrorCode)
})

afterEach(() => {
    vi.unstubAllGlobals()
    searchByImage.mockReset()
})

const photo = new File(['x'], 'dog.jpg', { type: 'image/jpeg' })
const apiError = (code: string) =>
    Object.assign(new FetchError('Request failed'), { data: { error: { code, message: code } } })

describe('useImageSearch', () => {
    it('is inactive until a search starts', () => {
        expect(useImageSearch().active.value).toBe(false)
    })

    it('exposes the matching pets and their match percentage', async () => {
        const pet = { id: 'p1' } as PetDto
        searchByImage.mockResolvedValue({ items: [{ pet, match: 87 }] })
        const search = useImageSearch()

        await search.search(photo)

        expect(searchByImage).toHaveBeenCalledWith('data:image/jpeg;base64,eA==')
        expect(search.active.value).toBe(true)
        expect(search.searching.value).toBe(false)
        expect(search.pets.value).toEqual([pet])
        expect(search.matches.value).toEqual({ p1: 87 })
    })

    it.each([
        ['unavailable', 'image_search_unavailable'],
        ['rate_limited', 'too_many_searches'],
        ['internal', 'error_try_later']
    ])('explains a %s error', async (code, message) => {
        searchByImage.mockRejectedValue(apiError(code))
        const search = useImageSearch()

        await search.search(photo)

        expect(search.error.value).toBe(message)
        expect(search.results.value).toBeNull()
    })

    it('goes back to the listing on exit', async () => {
        searchByImage.mockRejectedValue(new Error('offline'))
        const search = useImageSearch()
        await search.search(photo)

        search.exit()

        expect(search.active.value).toBe(false)
    })
})
