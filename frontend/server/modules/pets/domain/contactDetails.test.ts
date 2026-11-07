import { describe, expect, it } from 'vitest'
import { looksLikeContactOrPayment } from './contactDetails'

describe('looksLikeContactOrPayment', () => {
    it.each([
        'Lo tengo yo, llámame al 612 345 678',
        'Contacto +34 612345678',
        'Escríbeme por WhatsApp',
        'mándame un correo a pepe@example.com',
        'más info en www.ejemplo.com',
        'mira ejemplo.es',
        'Necesito 50 € para el veterinario',
        'son 100 euros',
        'quiero la recompensa',
        'hazme un bizum',
        'Send money via PayPal',
        'I found it, text me'
    ])('flags "%s"', text => {
        expect(looksLikeContactOrPayment(text)).toBe(true)
    })

    it.each([
        'Lo vi cruzando la calle Mayor hacia el parque',
        'Estaba junto a la gasolinera de la avenida 3 de mayo, a las 9',
        'Llevaba un collar rojo y parecía asustado',
        'Paiporta, barrio de la Estación'
    ])('lets "%s" through', text => {
        expect(looksLikeContactOrPayment(text)).toBe(false)
    })

    it('checks every text given', () => {
        expect(looksLikeContactOrPayment('Lo vi en el parque', 'Bizum al 600')).toBe(true)
    })
})
