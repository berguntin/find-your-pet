import { describe, expect, it } from 'vitest'
import { authMessagesEn } from '../../auth/locales/en'
import { authMessagesEs } from '../../auth/locales/es'
import { sightingsMessagesEn } from './en'
import { sightingsMessagesEs } from './es'

describe('feature locales', () => {
    it.each([
        ['auth', authMessagesEs, authMessagesEn],
        ['sightings', sightingsMessagesEs, sightingsMessagesEn]
    ] as [string, Record<string, string>, Record<string, string>][])(
        '%s has the same keys and the same placeholders in Spanish and English',
        (_, es, en) => {
            expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort())
            const placeholders = (text = '') => (text.match(/\{\w+\}/g) ?? []).sort()
            for (const [key, text] of Object.entries(es)) {
                expect(placeholders(en[key]), key).toEqual(placeholders(text))
                expect(text.trim(), key).not.toBe('')
            }
        }
    )
})
