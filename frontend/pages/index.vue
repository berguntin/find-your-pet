<script setup lang="ts">
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
</script>

<template>
    <AppHero @search="handleSearch" />
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
