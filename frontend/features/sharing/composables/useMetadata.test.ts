import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PetDto } from '../../../contracts/pets'
import { useMetadata } from './useMetadata'

const BASE_URL = 'https://mascotas.test'

const pet = (overrides: Partial<PetDto> = {}): PetDto => ({
    id: 'f9cef7cc-bb44-4119-b78f-c9241d86c03d',
    reportType: 'lost',
    species: 'dog',
    name: 'Toby',
    description: 'Perro marrón',
    location: 'Paiporta',
    contact: '600000000',
    images: ['https://img.test/1.jpg', 'https://img.test/2.jpg'],
    alive: true,
    eventDate: '2026-10-18',
    resolution: 'open',
    resolvedBy: null,
    resolvedAt: null,
    moderationStatus: 'approved',
    createdAt: '2026-10-19T10:00:00.000Z',
    ...overrides
})

beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { baseUrl: BASE_URL } }))
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('useMetadata', () => {
    it('asks for help finding a lost pet', () => {
        const meta = useMetadata(pet())

        expect(meta).toMatchObject({
            title: 'Ayúdame a encontrar a Toby',
            text: 'Perro marrón',
            image: 'https://img.test/1.jpg',
            url: `${BASE_URL}/mascota/f9cef7cc-bb44-4119-b78f-c9241d86c03d`
        })
        expect(meta.hastags.split(',')).toContain('perdido')
    })

    it('asks who is looking for a found pet', () => {
        const meta = useMetadata(pet({ reportType: 'found', name: null }))

        expect(meta.title).toBe('¿Alguien lo busca?')
        expect(meta.hastags.split(',')).toContain('encontrado')
    })

    it('celebrates reunited pets', () => {
        const meta = useMetadata(pet({ resolution: 'reunited' }))

        expect(meta.title).toBe('Toby ya está con su familia!')
        expect(meta.text).toBe('Una historia con final feliz')
    })

    it('uses a neutral image for deceased pets', () => {
        const meta = useMetadata(pet({ reportType: 'found', alive: false }))

        expect(meta.image).toBe(`${BASE_URL}/images/sensitive_content.webp`)
        expect(meta.text).toMatch(/fallecido/)
    })

    it('truncates long descriptions', () => {
        const meta = useMetadata(pet({ description: 'x'.repeat(200) }))

        expect(meta.text).toBe(`${'x'.repeat(150)}...`)
    })

    it('returns empty metadata without a pet', () => {
        expect(useMetadata(null)).toMatchObject({ title: '', url: '', via: BASE_URL })
    })
})
