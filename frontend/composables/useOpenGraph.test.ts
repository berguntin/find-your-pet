import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PetDto } from '../contracts/pets'
import { useMetadata } from './useMetadata'
import { useOpenGraph } from './useOpenGraph'

beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { baseUrl: 'https://mascotas.test' } }))
    // Auto-imported in Nuxt; in tests the composable resolves it as a global.
    vi.stubGlobal('useMetadata', useMetadata)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('useOpenGraph', () => {
    it('builds the title and social tags from the pet metadata', () => {
        const pet = {
            id: 'abc',
            reportType: 'lost',
            name: 'Toby',
            description: 'Perro marrón',
            images: ['https://img.test/1.jpg'],
            alive: true,
            resolution: 'open'
        } as PetDto

        const head = useOpenGraph(pet)
        const tag = (key: string) => head.meta.find(m => ('property' in m ? m.property : m.name) === key)?.content

        expect(head.title).toBe('Ayúdame a encontrar a Toby')
        expect(tag('og:image')).toBe('https://img.test/1.jpg')
        expect(tag('og:url')).toBe('https://mascotas.test/mascota/abc')
        expect(tag('twitter:description')).toBe('Perro marrón')
    })
})
