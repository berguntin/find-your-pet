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

    const actualFilters = ref<Filters>({
        status: 'all',
        location: ''
    })

    const search = ref<String>('')
    const config = useRuntimeConfig()

    const { data: pets, status, error } = await useFetch<Pet[]>(`/api/pets`)

    const getPets = computed(() => {
        if (!pets.value) return []

        return pets.value.filter(pet => {
            const matchesSearch = search.value
                ? Object.values(pet).some(value => {
                      if (typeof value !== 'string') return false
                      return value.toLowerCase().includes(search.value.toLowerCase())
                  })
                : true

            const matchesStatus =
                actualFilters.value.status !== 'all' ? pet.status === actualFilters.value.status : true

            return matchesSearch && matchesStatus
        })
    })

    const setFilter = (filters: Filters) => {
        actualFilters.value = filters
    }

    const handleSearch = (query: String) => {
        search.value = query
    }
</script>

<template>
    <AppHero @search="handleSearch" />
    <div class="flex flex-col md:flex-row items-center justify-between gap-2 pt-8 pb-4 sticky top-0 bg-base-100/70 z-20 backdrop-blur">
        <AppSearch @update-query="emitSearch" />
        <AppFilters @@set-filter="setFilter" />
    </div>
    <AppError v-if="error" class="mx-auto" />
    <ClientOnly>
        <AppLoading v-if="status === 'pending'" class="text-center py-8" />
    </ClientOnly>
    <ListPets :pets="getPets" />
</template>
