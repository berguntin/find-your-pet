import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAccountApi } from './useAccountApi'

const $fetch = vi.fn()

beforeEach(() => {
    vi.stubGlobal('$fetch', $fetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    $fetch.mockReset()
})

describe('useAccountApi', () => {
    it('deletes the account, optionally with its notices', async () => {
        await useAccountApi().deleteAccount({ deletePets: true })

        expect($fetch).toHaveBeenCalledWith('/api/v1/me', { method: 'DELETE', body: { deletePets: true } })
    })
})
