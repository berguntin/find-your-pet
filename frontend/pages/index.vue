<script setup lang="ts">
    const { t } = useI18n()

    useHead(() => ({
        title: `${t('app_name')} · ${t('home_meta_title')}`,
        meta: [{ name: 'description', content: t('home_meta_description') }]
    }))

    const api = usePetsApi()
    const filters = ref<Filters>({ reportType: 'all', species: 'all' })
    const search = ref('')

    const query = computed(() => ({
        reportType: filters.value.reportType === 'all' ? undefined : filters.value.reportType,
        species: filters.value.species === 'all' ? undefined : filters.value.species,
        q: search.value || undefined
    }))

    // First page is rendered on the server; "load more" pages are appended on the client.
    const {
        data: firstPage,
        status,
        error
    } = await useAsyncData('pets', () => api.list(query.value), {
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
    const loading = computed(() => status.value === 'pending')
    const hasActiveFilters = computed(
        () => !!search.value || filters.value.reportType !== 'all' || filters.value.species !== 'all'
    )

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

    const clearFilters = () => {
        filters.value = { reportType: 'all', species: 'all' }
        search.value = ''
    }

    const {
        active: inImageSearch,
        searching: imageSearching,
        error: imageSearchError,
        results: imageResults,
        pets: imagePets,
        matches: imageMatches,
        search: searchByImage,
        exit: exitImageSearch
    } = useImageSearch()
</script>

<template>
    <AppHero @search="text => (search = text)" @search-by-image="searchByImage" />

    <section class="mx-auto max-w-6xl px-4 sm:px-6" aria-live="polite">
        <!-- Search by photo -->
        <template v-if="inImageSearch">
            <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2>{{ $t('photo_search_title') }}</h2>
                <button class="btn btn-ghost btn-sm" @click="exitImageSearch">
                    <Icon name="mdi:arrow-left" /> {{ $t('back_to_list') }}
                </button>
            </div>
            <PetList v-if="imageSearching" :pets="[]" loading />
            <EmptyState v-else-if="imageSearchError" icon="mdi:camera-off-outline" :title="imageSearchError" />
            <template v-else-if="imageResults">
                <p v-if="imagePets.length" class="mb-4 text-sm text-muted">{{ $t('photo_search_results') }}</p>
                <EmptyState
                    v-else
                    icon="mdi:image-search-outline"
                    :title="$t('no_photo_matches')"
                    :description="$t('no_photo_matches_hint')"
                >
                    <NuxtLink to="/registrar" class="btn btn-primary btn-sm">{{ $t('publish_report') }}</NuxtLink>
                </EmptyState>
                <PetList :pets="imagePets" :matches="imageMatches" />
            </template>
        </template>

        <!-- Listing -->
        <template v-else>
            <div class="mb-5 flex flex-col gap-4">
                <div class="flex flex-wrap items-baseline justify-between gap-2">
                    <h2>{{ search ? $t('results_for', { query: search }) : $t('recent_reports') }}</h2>
                    <button v-if="hasActiveFilters" class="btn btn-link btn-sm px-0" @click="clearFilters">
                        {{ $t('clear_filters') }}
                    </button>
                </div>
                <PetFilters v-model="filters" />
            </div>

            <EmptyState v-if="error" icon="mdi:cloud-alert-outline" :title="$t('error_try_later')" />
            <EmptyState
                v-else-if="!loading && pets.length === 0"
                :title="hasActiveFilters ? $t('no_results') : $t('no_reports_yet')"
                :description="hasActiveFilters ? $t('no_results_hint') : $t('no_reports_yet_hint')"
            >
                <button v-if="hasActiveFilters" class="btn btn-ghost btn-sm" @click="clearFilters">
                    {{ $t('clear_filters') }}
                </button>
                <NuxtLink to="/registrar" class="btn btn-primary btn-sm">{{ $t('publish_report') }}</NuxtLink>
            </EmptyState>
            <PetList v-else :pets="pets" :loading="loading" />

            <div v-if="nextCursor && !loading" class="mt-8 flex justify-center">
                <button class="btn btn-outline" :disabled="loadingMore" @click="loadMore">
                    <span v-if="loadingMore" class="loading loading-spinner loading-sm" />
                    {{ $t('load_more') }}
                </button>
            </div>
        </template>
    </section>
</template>
