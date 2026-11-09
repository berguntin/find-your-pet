import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSightingsApi } from './useSightingsApi'

const $fetch = vi.fn()
const PET = 'f9cef7cc-bb44-4119-b78f-c9241d86c03d'
const SIGHTING = '0b5d6c1e-2f43-4b7a-9d55-3a1f0e8c7b21'

beforeEach(() => {
    vi.stubGlobal('$fetch', $fetch)
})

afterEach(() => {
    vi.unstubAllGlobals()
    $fetch.mockReset()
})

describe('useSightingsApi', () => {
    it('lists and reports the sightings of a pet', async () => {
        const api = useSightingsApi()
        const body = { description: 'Lo vi en el parque', area: 'Paiporta', seenAt: '2026-11-08T09:00:00Z' }
        await api.list(PET)
        await api.report(PET, body)

        expect($fetch).toHaveBeenNthCalledWith(1, `/api/v1/pets/${PET}/sightings`)
        expect($fetch).toHaveBeenNthCalledWith(2, `/api/v1/pets/${PET}/sightings`, { method: 'POST', body })
    })

    it('validates and deletes a sighting', async () => {
        const api = useSightingsApi()
        await api.validate(SIGHTING)
        await api.hide(SIGHTING)
        await api.remove(SIGHTING)

        expect($fetch).toHaveBeenNthCalledWith(1, `/api/v1/sightings/${SIGHTING}/validations`, { method: 'POST' })
        expect($fetch).toHaveBeenNthCalledWith(2, `/api/v1/sightings/${SIGHTING}/hide`, { method: 'POST' })
        expect($fetch).toHaveBeenNthCalledWith(3, `/api/v1/sightings/${SIGHTING}`, { method: 'DELETE' })
    })
})
