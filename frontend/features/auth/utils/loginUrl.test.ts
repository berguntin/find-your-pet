import { describe, expect, it } from 'vitest'
import { loginUrl, sameSitePath } from './loginUrl'

describe('loginUrl', () => {
    it('encodes the return path', () => {
        expect(loginUrl('/mascota/1?tab=sightings')).toBe('/auth/google?returnTo=%2Fmascota%2F1%3Ftab%3Dsightings')
    })
})

describe('sameSitePath', () => {
    it('keeps paths on this site and drops anything else', () => {
        expect(sameSitePath('/mascota/1')).toBe('/mascota/1')
        expect(sameSitePath('//evil.example')).toBe('/')
        expect(sameSitePath('/\\evil.example')).toBe('/')
        expect(sameSitePath('https://evil.example')).toBe('/')
        expect(sameSitePath(undefined)).toBe('/')
    })
})
