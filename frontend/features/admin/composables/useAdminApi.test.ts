import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAdminApi } from './useAdminApi'

const fetcher = vi.fn()
const ID = 'f9cef7cc-bb44-4119-b78f-c9241d86c03d'

beforeEach(() => {
    vi.stubGlobal('useRequestFetch', () => fetcher)
})

afterEach(() => {
    vi.unstubAllGlobals()
    fetcher.mockReset()
})

describe('useAdminApi', () => {
    it('lists pets with the query as search params', async () => {
        await useAdminApi().listPets({ moderationStatus: 'all', q: 'gato' })

        expect(fetcher).toHaveBeenCalledWith('/api/v1/admin/pets', { query: { moderationStatus: 'all', q: 'gato' } })
    })

    it('gets and updates one pet', async () => {
        const api = useAdminApi()
        await api.getPet(ID)
        await api.updatePet(ID, { location: 'Sedaví' })

        expect(fetcher).toHaveBeenNthCalledWith(1, `/api/v1/admin/pets/${ID}`)
        expect(fetcher).toHaveBeenNthCalledWith(2, `/api/v1/admin/pets/${ID}`, {
            method: 'PATCH',
            body: { location: 'Sedaví' }
        })
    })

    it('moderates and deletes', async () => {
        const api = useAdminApi()
        await api.moderatePet(ID, 'pending_review')
        await api.deletePet(ID)

        expect(fetcher).toHaveBeenNthCalledWith(1, `/api/v1/admin/pets/${ID}/moderation`, {
            method: 'PATCH',
            body: { status: 'pending_review' }
        })
        expect(fetcher).toHaveBeenNthCalledWith(2, `/api/v1/pets/${ID}`, { method: 'DELETE' })
    })

    it('reads statistics for a period', async () => {
        const api = useAdminApi()
        await api.stats(7)
        await api.moderation(90)

        expect(fetcher).toHaveBeenNthCalledWith(1, '/api/v1/admin/stats', { query: { days: 7 } })
        expect(fetcher).toHaveBeenNthCalledWith(2, '/api/v1/admin/moderation', { query: { days: 90 } })
    })
})
