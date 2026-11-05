import { describe, expect, it } from 'vitest'
import { contactActions } from './contact'

describe('contactActions', () => {
    it('offers call and WhatsApp for Spanish phone numbers', () => {
        expect(contactActions('600 111 222')).toEqual([
            { kind: 'phone', href: 'tel:+34600111222', label: '600 111 222' },
            { kind: 'whatsapp', href: 'https://wa.me/34600111222', label: '600 111 222' }
        ])
    })

    it('keeps international prefixes', () => {
        expect(contactActions('+44 7700 900123')[0]).toEqual({
            kind: 'phone',
            href: 'tel:+447700900123',
            label: '+44 7700 900123'
        })
    })

    it('offers email for addresses', () => {
        expect(contactActions('nala.familia@gmail.com')).toEqual([
            { kind: 'email', href: 'mailto:nala.familia@gmail.com', label: 'nala.familia@gmail.com' }
        ])
    })

    it('links Instagram handles', () => {
        expect(contactActions('@rescate_vlc')).toEqual([
            { kind: 'instagram', href: 'https://instagram.com/rescate_vlc', label: '@rescate_vlc' }
        ])
    })

    it('finds several channels in one text', () => {
        expect(contactActions('Llamar al 611333444 o escribir a ana@example.com').map(a => a.kind)).toEqual([
            'email',
            'phone',
            'whatsapp'
        ])
    })

    it('links URLs without mistaking their digits for a phone', () => {
        expect(contactActions('https://facebook.com/groups/123456789').map(a => a.kind)).toEqual(['link'])
    })

    it('returns nothing for text it does not understand', () => {
        expect(contactActions('Preguntar en la farmacia de la plaza')).toEqual([])
    })
})
