import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { THEME_COOKIE_OPTIONS, useTheme } from './useTheme'

// Like Nuxt: every useCookie call gets its own ref over the same stored value,
// while useState returns the same ref for the same key.
let stored: string | null
let cookieRefs: Ref<string | null>[]
let cookieCalls: unknown[][]
let states: Map<string, Ref<unknown>>

beforeEach(() => {
    stored = null
    cookieRefs = []
    cookieCalls = []
    states = new Map()
    // Auto-imported in Nuxt; in tests the composable resolves them as globals.
    vi.stubGlobal('useCookie', (...args: unknown[]) => {
        cookieCalls.push(args)
        const cookie = ref<string | null>(stored)
        cookieRefs.push(cookie)
        return cookie
    })
    vi.stubGlobal('useState', <T>(key: string, init: () => T) => {
        if (!states.has(key)) states.set(key, ref(init()))
        return states.get(key)
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('useTheme', () => {
    it('follows the system when there is no cookie', () => {
        expect(useTheme().preference.value).toBe('system')
    })

    it('reads an explicit choice from the cookie', () => {
        stored = 'dark'
        expect(useTheme().preference.value).toBe('dark')
    })

    it('ignores a tampered cookie', () => {
        stored = 'neon'
        expect(useTheme().preference.value).toBe('system')
    })

    it('stores an explicit choice and removes the cookie when going back to the system', () => {
        const { preference } = useTheme()
        preference.value = 'light'
        expect(cookieRefs[0]?.value).toBe('light')
        preference.value = 'system'
        expect(cookieRefs[0]?.value).toBeNull()
    })

    it('keeps every instance in sync (app.vue and each switch)', () => {
        const app = useTheme()
        const headerSwitch = useTheme()
        headerSwitch.preference.value = 'dark'
        expect(app.preference.value).toBe('dark')
    })

    it('uses the cookie options stated in the privacy policy', () => {
        useTheme()
        expect(cookieCalls[0]).toEqual(['theme', { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' }])
        expect(THEME_COOKIE_OPTIONS.maxAge).toBe(31536000)
    })
})
