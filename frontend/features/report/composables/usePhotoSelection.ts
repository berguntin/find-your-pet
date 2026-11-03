export interface Photo {
    file: File
    preview: string
}

/**
 * The photos chosen for a report, with local previews. The first one is the main photo: it is shown
 * on cards and used to pre-fill the details. Previews are released when they are no longer shown.
 */
export const usePhotoSelection = (max: number) => {
    const photos = ref<Photo[]>([])

    const add = (files: FileList | File[] | null | undefined) => {
        const images = Array.from(files ?? []).filter(file => file.type.startsWith('image/'))
        const room = max - photos.value.length
        photos.value.push(...images.slice(0, room).map(file => ({ file, preview: URL.createObjectURL(file) })))
    }

    const remove = (index: number) => {
        const [removed] = photos.value.splice(index, 1)
        if (removed) URL.revokeObjectURL(removed.preview)
    }

    const setMain = (index: number) => {
        const [photo] = photos.value.splice(index, 1)
        if (photo) photos.value.unshift(photo)
    }

    const clear = () => {
        photos.value.forEach(photo => URL.revokeObjectURL(photo.preview))
        photos.value = []
    }

    onBeforeUnmount(clear)

    return { photos, add, remove, setMain, clear }
}
