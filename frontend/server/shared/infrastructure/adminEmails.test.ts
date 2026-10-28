import { describe, expect, it } from 'vitest'
import { isAdminEmail, parseEmailList } from './adminEmails'

describe('admin emails', () => {
    it('parses a comma-separated list, normalised', () => {
        expect(parseEmailList(' Ana@Example.com, ,luis@example.com ')).toEqual(['ana@example.com', 'luis@example.com'])
        expect(parseEmailList(undefined)).toEqual([])
    })

    it('matches emails regardless of case and spaces', () => {
        expect(isAdminEmail(' ANA@example.com', ['ana@example.com'])).toBe(true)
        expect(isAdminEmail('otro@example.com', ['ana@example.com'])).toBe(false)
        expect(isAdminEmail(null, ['ana@example.com'])).toBe(false)
        expect(isAdminEmail('', [''])).toBe(false)
    })
})
