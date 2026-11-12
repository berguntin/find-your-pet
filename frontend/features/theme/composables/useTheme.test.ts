import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, type Ref } from 'vue'
import { useTheme } from './useTheme'

let cookie: Ref<string | null>

beforeEach(() => {
    cookie = ref<string | null>(null)
    // Auto-imported in Nuxt; in tests the composable resolves it as a global.
    vi.stubGlobal('useCookie', () => cookie)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('useTheme', () => {
    it('follows the system when there is no cookie', () => {
        expect(useTheme().preference.value).toBe('system')
    })

    it('reads an explicit choice from the cookie', () => {
        cookie.value = 'dark'
        expect(useTheme().preference.value).toBe('dark')
    })

    it('stores an explicit choice and removes the cookie when going back to the system', () => {
        const { preference } = useTheme()
        preference.value = 'light'
        expect(cookie.value).toBe('light')
        preference.value = 'system'
        expect(cookie.value).toBeNull()
    })
})
