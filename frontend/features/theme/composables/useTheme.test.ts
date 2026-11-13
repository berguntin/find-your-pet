import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, type Ref } from 'vue'
import { useTheme, useThemeSync } from './useTheme'

// Lifecycle hooks run by hand: there is no component in these tests.
const lifecycle = vi.hoisted(() => ({ mounted: [] as (() => void)[], unmounted: [] as (() => void)[] }))
vi.mock('vue', async original => ({
    ...(await original<typeof import('vue')>()),
    onMounted: (hook: () => void) => lifecycle.mounted.push(hook),
    onBeforeUnmount: (hook: () => void) => lifecycle.unmounted.push(hook)
}))

interface HeadInput {
    htmlAttrs: { 'data-theme'?: string }
    meta: { name: string; content: string; media?: string }[]
}

let states: Map<string, Ref<unknown>>
let cookie: Ref<string | null | undefined>
let head: () => HeadInput
let documentCookie: string
let visibility: DocumentVisibilityState
let systemListener: ((event: { matches: boolean }) => void) | undefined
let visibilityListener: (() => void) | undefined
const removeMediaListener = vi.fn()
const removeDocumentListener = vi.fn()

beforeEach(() => {
    states = new Map()
    cookie = ref()
    documentCookie = ''
    visibility = 'visible'
    lifecycle.mounted.length = 0
    lifecycle.unmounted.length = 0

    // Nuxt auto-imports, resolved as globals in tests.
    vi.stubGlobal('useState', (key: string, init: () => unknown) => {
        if (!states.has(key)) states.set(key, ref(init()))
        return states.get(key)
    })
    vi.stubGlobal('useCookie', () => cookie)
    vi.stubGlobal('useHead', (input: () => HeadInput) => (head = input))
    vi.stubGlobal('window', {
        matchMedia: () => ({
            matches: true,
            addEventListener: (_: string, listener: typeof systemListener) => (systemListener = listener),
            removeEventListener: removeMediaListener
        })
    })
    vi.stubGlobal('document', {
        get cookie() {
            return documentCookie
        },
        get visibilityState() {
            return visibility
        },
        addEventListener: (_: string, listener: typeof visibilityListener) => (visibilityListener = listener),
        removeEventListener: removeDocumentListener
    })
})

afterEach(() => {
    vi.unstubAllGlobals()
    removeMediaListener.mockClear()
    removeDocumentListener.mockClear()
})

const mount = () => lifecycle.mounted.forEach(hook => hook())

describe('useTheme', () => {
    it('is unknown until the system preference is read, and the toggle does nothing meanwhile', () => {
        const { effective, toggle } = useTheme()

        toggle()

        expect(effective.value).toBeNull()
        expect(states.get('theme-preference')?.value).toBeNull()
    })

    it('follows the system without a choice and stores the opposite when toggled', () => {
        useThemeSync()
        mount()
        const { effective, toggle } = useTheme()
        expect(effective.value).toBe('dark')

        toggle()

        expect(effective.value).toBe('light')
        expect(states.get('theme-preference')?.value).toBe('light')
    })

    it('prefers the user choice over the system', () => {
        documentCookie = 'theme=light'
        useThemeSync()
        mount()

        expect(useTheme().effective.value).toBe('light')
    })
})

describe('useThemeSync', () => {
    it('writes the choice to the cookie and to <html data-theme>', async () => {
        useThemeSync()
        mount()

        useTheme().toggle()
        await nextTick()

        expect(cookie.value).toBe('light')
        expect(head().htmlAttrs['data-theme']).toBe('light')
        expect(head().meta).toEqual([expect.objectContaining({ name: 'theme-color', content: '#FFFBF5' })])
        expect(head().meta[0]?.media).toBeUndefined()
    })

    it('leaves data-theme out and sends one theme-color per scheme without a choice', () => {
        useThemeSync()

        expect(head().htmlAttrs['data-theme']).toBeUndefined()
        expect(head().meta.map(meta => meta.media)).toEqual([
            '(prefers-color-scheme: light)',
            '(prefers-color-scheme: dark)'
        ])
    })

    // Nuxt's useCookie updates its ref when another tab changes the cookie (cookieStore or BroadcastChannel); here the
    // ref is changed by hand to check that such an update reaches data-theme.
    it('applies changes to the cookie ref, as useCookie does when another tab changes it', async () => {
        useThemeSync()
        mount()

        cookie.value = 'dark'
        await nextTick()
        expect(head().htmlAttrs['data-theme']).toBe('dark')

        cookie.value = 'tampered'
        await nextTick()
        expect(head().htmlAttrs['data-theme']).toBeUndefined()
    })

    it('reads the cookie again when the tab becomes visible', () => {
        useThemeSync()
        mount()

        documentCookie = 'theme=dark'
        visibility = 'hidden'
        visibilityListener?.()
        expect(states.get('theme-preference')?.value).toBeNull()

        visibility = 'visible'
        visibilityListener?.()
        expect(states.get('theme-preference')?.value).toBe('dark')
    })

    it('tracks system changes and removes its listeners on unmount', () => {
        useThemeSync()
        mount()

        systemListener?.({ matches: false })
        expect(useTheme().effective.value).toBe('light')

        lifecycle.unmounted.forEach(hook => hook())
        expect(removeMediaListener).toHaveBeenCalled()
        expect(removeDocumentListener).toHaveBeenCalled()
    })
})
