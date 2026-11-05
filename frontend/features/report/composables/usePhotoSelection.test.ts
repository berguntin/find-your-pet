import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePhotoSelection } from './usePhotoSelection'

const createObjectURL = vi.fn((file: File) => `blob:${file.name}`)
const revokeObjectURL = vi.fn()

beforeEach(() => {
    // Auto-imported in Nuxt; in tests the composable resolves them as globals.
    vi.stubGlobal('ref', ref)
    vi.stubGlobal('onBeforeUnmount', vi.fn())
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
})

afterEach(() => {
    vi.unstubAllGlobals()
    createObjectURL.mockClear()
    revokeObjectURL.mockClear()
})

const image = (name: string) => new File(['x'], name, { type: 'image/jpeg' })
const names = (photos: { file: File }[]) => photos.map(photo => photo.file.name)

describe('usePhotoSelection', () => {
    it('adds images up to the limit and ignores other files', () => {
        const { photos, add } = usePhotoSelection(2)

        add([image('a.jpg'), new File(['x'], 'notes.txt', { type: 'text/plain' }), image('b.jpg'), image('c.jpg')])

        expect(names(photos.value)).toEqual(['a.jpg', 'b.jpg'])
        expect(photos.value[0]?.preview).toBe('blob:a.jpg')
    })

    it('moves the chosen photo to the front as the main one', () => {
        const { photos, add, setMain } = usePhotoSelection(5)
        add([image('a.jpg'), image('b.jpg'), image('c.jpg')])

        setMain(2)

        expect(names(photos.value)).toEqual(['c.jpg', 'a.jpg', 'b.jpg'])
    })

    it('releases the preview of removed and cleared photos', () => {
        const { photos, add, remove, clear } = usePhotoSelection(5)
        add([image('a.jpg'), image('b.jpg'), image('c.jpg')])

        remove(1)
        expect(names(photos.value)).toEqual(['a.jpg', 'c.jpg'])
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:b.jpg')

        clear()
        expect(photos.value).toEqual([])
        expect(revokeObjectURL).toHaveBeenCalledTimes(3)
    })

    it('releases the previews when the page is left', () => {
        const onBeforeUnmount = vi.fn()
        vi.stubGlobal('onBeforeUnmount', onBeforeUnmount)
        const { add } = usePhotoSelection(5)
        add([image('a.jpg')])

        onBeforeUnmount.mock.calls[0]?.[0]()

        expect(revokeObjectURL).toHaveBeenCalledWith('blob:a.jpg')
    })
})
