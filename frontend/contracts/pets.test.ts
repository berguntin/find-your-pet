import { describe, expect, it } from 'vitest'
import { describePetSchema, listPetsQuerySchema, petIdSchema, reportPetSchema, updatePetSchema } from './pets'

const validReport = {
    reportType: 'lost',
    species: 'cat',
    name: 'Luna',
    description: 'Gata tricolor',
    location: 'Alfafar',
    contact: '600000000',
    eventDate: '2026-10-10',
    images: ['https://res.cloudinary.com/demo/image/upload/v1/pets/a.jpg']
}

describe('reportPetSchema', () => {
    it('accepts a valid report and defaults alive to true', () => {
        const parsed = reportPetSchema.parse(validReport)

        expect(parsed.alive).toBe(true)
    })

    it('accepts a missing or null name', () => {
        const { name: _name, ...withoutName } = validReport

        expect(reportPetSchema.safeParse(withoutName).success).toBe(true)
        expect(reportPetSchema.safeParse({ ...validReport, name: null }).success).toBe(true)
    })

    it('trims text fields', () => {
        expect(reportPetSchema.parse({ ...validReport, location: '  Alfafar  ' }).location).toBe('Alfafar')
    })

    it.each([
        ['an unknown report type', { reportType: 'stolen' }],
        ['an unknown species', { species: 'Perro' }],
        ['a blank description', { description: '   ' }],
        ['a non-ISO date', { eventDate: '10/10/2026' }],
        ['no images', { images: [] }],
        ['more than 10 images', { images: Array.from({ length: 11 }, (_, i) => `https://img.test/${i}.jpg`) }],
        ['an image that is not a URL', { images: ['not-a-url'] }],
        ['alive as a string', { alive: 'true' }]
    ])('rejects %s', (_, overrides) => {
        expect(reportPetSchema.safeParse({ ...validReport, ...overrides }).success).toBe(false)
    })
})

describe('listPetsQuerySchema', () => {
    it('defaults the page size to 24', () => {
        expect(listPetsQuerySchema.parse({}).limit).toBe(24)
    })

    it('coerces query-string numbers', () => {
        expect(listPetsQuerySchema.parse({ limit: '10' }).limit).toBe(10)
    })

    it.each([
        ['limit above 50', { limit: '51' }],
        ['limit below 1', { limit: '0' }],
        ['a non-integer limit', { limit: '2.5' }],
        ['an unknown report type', { reportType: 'all' }],
        ['a very long search', { q: 'x'.repeat(101) }]
    ])('rejects %s', (_, query) => {
        expect(listPetsQuerySchema.safeParse(query).success).toBe(false)
    })
})

describe('other schemas', () => {
    it('only allows marking a pet as reunited', () => {
        expect(updatePetSchema.safeParse({ resolution: 'reunited' }).success).toBe(true)
        expect(updatePetSchema.safeParse({ resolution: 'open' }).success).toBe(false)
    })

    it('only accepts base64 jpeg, png or webp images for analysis', () => {
        expect(describePetSchema.safeParse({ image: 'data:image/jpeg;base64,AAAA' }).success).toBe(true)
        expect(describePetSchema.safeParse({ image: 'data:image/gif;base64,AAAA' }).success).toBe(false)
        expect(describePetSchema.safeParse({ image: 'https://img.test/a.jpg' }).success).toBe(false)
    })

    it('rejects images over the size limit', () => {
        const image = `data:image/jpeg;base64,${'A'.repeat(2_000_000)}`

        expect(describePetSchema.safeParse({ image }).success).toBe(false)
    })

    it('validates pet ids as UUIDs', () => {
        expect(petIdSchema.safeParse('f9cef7cc-bb44-4119-b78f-c9241d86c03d').success).toBe(true)
        expect(petIdSchema.safeParse('123').success).toBe(false)
    })
})
