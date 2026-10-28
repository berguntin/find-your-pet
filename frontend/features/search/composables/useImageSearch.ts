import type { PetMatchDto } from '~~/contracts/pets'

/** Search by photo on the home page. Its results replace the listing until the user goes back. */
export const useImageSearch = () => {
    const { t } = useI18n()
    const api = usePetsApi()

    const results = ref<PetMatchDto[] | null>(null)
    const searching = ref(false)
    const error = ref<string | null>(null)

    const active = computed(() => searching.value || results.value !== null || !!error.value)
    const pets = computed(() => (results.value ?? []).map(result => result.pet))
    /** Match percentage per pet id. */
    const matches = computed(() =>
        Object.fromEntries((results.value ?? []).map(result => [result.pet.id, result.match]))
    )

    const search = async (file: File) => {
        searching.value = true
        error.value = null
        results.value = null
        try {
            const image = await blobToDataUrl(await resizeImage(file, 768, 0.8))
            results.value = (await api.searchByImage(image)).items
        } catch (err) {
            const code = apiErrorCode(err)
            error.value =
                code === 'unavailable'
                    ? t('image_search_unavailable')
                    : code === 'rate_limited'
                    ? t('too_many_searches')
                    : t('error_try_later')
        } finally {
            searching.value = false
        }
    }

    const exit = () => {
        results.value = null
        error.value = null
    }

    return { results, searching, error, active, pets, matches, search, exit }
}
