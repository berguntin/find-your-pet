<script setup lang="ts">
    import { FetchError } from 'ofetch'
    import type { ApiErrorDto, PetMatchDto } from '~~/contracts/pets'

    useHead({
        title: 'Animales perdidos y encontrados',
        meta: [
            {
                name: 'description',
                content:
                    'Busca y encuentra tu mascota perdida. Web creada para ayudar a que los peludos se vuelvan a reunir con su familia, especialmente tras las inundaciones de Valencia de 2024'
            },
            {
                name: 'keywords',
                content:
                    'mascotas, animales, perdidos, encontrados, perdidos y encontrados, animales perdidos valencia, animales perdidos DANA valencia, busco a mi perro, busco a mi gato, perro, gato, buscar a mi perro perdido valencia'
            }
        ]
    })

    const { t } = useI18n()
    const api = usePetsApi()
    const reportType = ref<ReportTypeFilter>('all')
    const search = ref('')

    const query = computed(() => ({
        reportType: reportType.value === 'all' ? undefined : reportType.value,
        q: search.value || undefined
    }))

    // First page is rendered on the server; "load more" pages are appended on the client.
    const { data: firstPage, status, error } = await useAsyncData('pets', () => api.list(query.value), {
        watch: [query]
    })

    const morePets = ref<Pet[]>([])
    const nextCursor = ref<string | null>(null)
    const loadingMore = ref(false)

    watch(
        firstPage,
        page => {
            morePets.value = []
            nextCursor.value = page?.nextCursor ?? null
        },
        { immediate: true }
    )

    const pets = computed(() => [...(firstPage.value?.items ?? []), ...morePets.value])

    const loadMore = async () => {
        if (!nextCursor.value || loadingMore.value) return
        loadingMore.value = true
        try {
            const page = await api.list({ ...query.value, cursor: nextCursor.value })
            morePets.value.push(...page.items)
            nextCursor.value = page.nextCursor
        } finally {
            loadingMore.value = false
        }
    }

    const setFilter = (filters: Filters) => {
        reportType.value = filters.reportType
    }

    const handleSearch = (text: string) => {
        search.value = text
    }

    // Image search replaces the listing until the user goes back.
    const imageResults = ref<PetMatchDto[] | null>(null)
    const imageSearching = ref(false)
    const imageSearchError = ref<string | null>(null)

    const imageMatches = computed(() =>
        Object.fromEntries((imageResults.value ?? []).map(result => [result.pet.id, result.match]))
    )

    const searchByImage = async (file: File) => {
        imageSearching.value = true
        imageSearchError.value = null
        try {
            const image = await blobToDataUrl(await resizeImage(file, 768, 0.8))
            imageResults.value = (await api.searchByImage(image)).items
        } catch (err) {
            const code = err instanceof FetchError ? (err.data as ApiErrorDto | undefined)?.error.code : undefined
            imageSearchError.value =
                code === 'unavailable'
                    ? t('image_search_unavailable')
                    : code === 'rate_limited'
                      ? t('too_many_searches')
                      : t('error_try_later')
        } finally {
            imageSearching.value = false
        }
    }

    const exitImageSearch = () => {
        imageResults.value = null
        imageSearchError.value = null
    }
</script>

<template>
    <AppHero @search="handleSearch" @search-by-image="searchByImage" />
    <div v-if="imageSearching" class="flex justify-center items-center gap-2 py-8">
        <span class="loading loading-spinner"></span>
        {{ $t('searching_by_photo') }}
    </div>
    <div v-else-if="imageSearchError" role="alert" class="alert alert-warning max-w-2xl mx-auto">
        <span>{{ imageSearchError }}</span>
        <button class="btn btn-sm" @click="exitImageSearch">{{ $t('back_to_list') }}</button>
    </div>
    <template v-else-if="imageResults">
        <div class="flex flex-col items-center gap-2 px-4">
            <p class="text-center">
                {{ imageResults.length ? $t('photo_search_results') : $t('no_photo_matches') }}
            </p>
            <button class="btn btn-sm btn-ghost" @click="exitImageSearch">
                <Icon name="mdi:arrow-left" /> {{ $t('back_to_list') }}
            </button>
        </div>
        <ListPets :pets="imageResults.map(result => result.pet)" :matches="imageMatches" />
    </template>
    <template v-else>
        <AppFilters @@set-filter="setFilter" />
        <AppError v-if="error" class="mx-auto" />
        <ClientOnly>
            <AppLoading v-if="status === 'pending'" class="text-center py-8" />
        </ClientOnly>
        <ListPets :pets="pets" />
        <div v-if="nextCursor" class="flex justify-center mb-8">
            <button class="btn btn-primary" :disabled="loadingMore" @click="loadMore">
                <span v-if="loadingMore" class="loading loading-spinner"></span>
                {{ $t('load_more') }}
            </button>
        </div>
    </template>
</template>
