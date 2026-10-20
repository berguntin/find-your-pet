import { describe, expect, it } from 'vitest'
import { SOCIAL_DESCRIPTION_MAX_LENGTH, socialPostMessage } from './socialPost'

const URL = 'https://mascotas.example/mascota/pet-1'

const pet = (overrides: Partial<Parameters<typeof socialPostMessage>[0]> = {}) => ({
    reportType: 'lost' as const,
    species: 'dog' as const,
    name: 'Toby',
    description: 'Perro marrón con una mancha blanca en el pecho.',
    location: 'Paiporta',
    eventDate: '2026-10-01',
    alive: true,
    resolution: 'open' as const,
    ...overrides
})

describe('socialPostMessage', () => {
    it('announces a lost pet with its zone, date, description and a link to its page', () => {
        expect(socialPostMessage(pet(), URL)).toBe(
            [
                '🔴 PERDIDO · Perro · Toby',
                '📍 Paiporta · 📅 01/10/2026',
                'Perro marrón con una mancha blanca en el pecho.',
                `ℹ️ Más información y contacto: ${URL}`,
                '🔁 Compártelo en los grupos de mascotas de tu zona.'
            ].join('\n\n')
        )
    })

    it('labels found pets, also when found dead, and skips a missing name', () => {
        expect(socialPostMessage(pet({ reportType: 'found', species: 'cat', name: null }), URL)).toMatch(
            /^🟢 ENCONTRADO · Gato\n/
        )
        expect(socialPostMessage(pet({ reportType: 'found', alive: false }), URL)).toMatch(
            /^ENCONTRADO SIN VIDA · Perro · Toby\n/
        )
    })

    it('marks reunited pets and stops asking to share them', () => {
        const message = socialPostMessage(pet({ resolution: 'reunited' }), URL)

        expect(message).toMatch(/^✅ ¡YA ESTÁ EN CASA!/)
        expect(message).toContain('🔴 PERDIDO · Perro · Toby')
        expect(message).not.toContain('Compártelo')
    })

    it('cuts long descriptions', () => {
        const message = socialPostMessage(pet({ description: 'a'.repeat(2000) }), URL)

        expect(message).toContain(`${'a'.repeat(SOCIAL_DESCRIPTION_MAX_LENGTH - 1)}…`)
        expect(message).not.toContain('a'.repeat(SOCIAL_DESCRIPTION_MAX_LENGTH))
    })
})
