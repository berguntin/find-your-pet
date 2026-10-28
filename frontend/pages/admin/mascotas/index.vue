<script setup lang="ts">
    import type { AdminListPetsQuery, AdminPetDto } from '~~/contracts/admin'

    definePageMeta({ layout: 'admin', middleware: 'admin' })

    const { t, locale } = useI18n()
    useHead({ title: () => t('admin_nav_pets') })

    const api = useAdminApi()
    const route = useRoute()
    const router = useRouter()

    // Filters live in the URL so a filtered list can be shared and survives reloads.
    const param = (name: string) => (typeof route.query[name] === 'string' ? (route.query[name] as string) : '')
    const setParam = (name: string, value: string) =>
        router.replace({ query: { ...route.query, [name]: value || undefined } })

    const statuses = [
        { value: '', label: 'admin_filter_all' },
        { value: 'pending_review', label: 'admin_status_pending_review' },
        { value: 'approved', label: 'admin_published' }
    ]

    const query = computed<AdminListPetsQuery>(() => ({
        moderationStatus: (param('estado') || 'all') as AdminListPetsQuery['moderationStatus'],
        reportType: (param('tipo') || undefined) as AdminListPetsQuery['reportType'],
        species: (param('especie') || undefined) as AdminListPetsQuery['species'],
        resolution: (param('resolucion') || undefined) as AdminListPetsQuery['resolution'],
        q: param('q') || undefined,
        limit: 30
    }))

    const search = ref(param('q'))
    let searchTimer: ReturnType<typeof setTimeout> | undefined
    watch(search, value => {
        clearTimeout(searchTimer)
        searchTimer = setTimeout(() => setParam('q', value.trim()), 300)
    })

    // The first page comes from useAsyncData (so it is transferred from SSR); "load more" pages append to it.
    const {
        data: firstPage,
        error,
        status
    } = await useAsyncData('admin-pets', () => api.listPets(query.value), {
        watch: [query]
    })
    const morePets = ref<AdminPetDto[]>([])
    const nextCursor = ref<string | null>(null)
    watch(
        firstPage,
        page => {
            morePets.value = []
            nextCursor.value = page?.nextCursor ?? null
        },
        { immediate: true }
    )
    const pets = computed(() => [...(firstPage.value?.items ?? []), ...morePets.value])

    const loadingMore = ref(false)
    const loadMore = async () => {
        if (!nextCursor.value) return
        loadingMore.value = true
        try {
            const page = await api.listPets({ ...query.value, cursor: nextCursor.value })
            morePets.value.push(...page.items)
            nextCursor.value = page.nextCursor
        } finally {
            loadingMore.value = false
        }
    }

    const busy = ref<string | null>(null)
    const actionError = ref(false)
    const moderate = async (pet: AdminPetDto, status: 'approved' | 'pending_review') => {
        busy.value = pet.id
        actionError.value = false
        try {
            const updated = await api.moderatePet(pet.id, status)
            if (updated) Object.assign(pet, updated)
        } catch {
            actionError.value = true
        } finally {
            busy.value = null
        }
    }

    const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }))
    const title = (pet: AdminPetDto) => pet.name || t(`unnamed_${pet.species}`)
</script>

<template>
    <div class="space-y-5">
        <div>
            <h1 class="text-2xl sm:text-3xl md:text-3xl">{{ $t('admin_nav_pets') }}</h1>
            <p class="text-sm text-muted">{{ $t('admin_pets_hint') }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <div class="join" role="group" :aria-label="$t('admin_filter_status')">
                <button
                    v-for="option in statuses"
                    :key="option.value"
                    type="button"
                    class="btn join-item btn-sm"
                    :class="param('estado') === option.value ? 'btn-neutral' : 'btn-ghost bg-base-100'"
                    :aria-pressed="param('estado') === option.value"
                    @click="setParam('estado', option.value)"
                >
                    {{ $t(option.label) }}
                </button>
            </div>
            <select
                class="select select-bordered select-sm bg-base-100"
                :value="param('tipo')"
                :aria-label="$t('filter_by_type')"
                @change="setParam('tipo', ($event.target as HTMLSelectElement).value)"
            >
                <option value="">{{ $t('filter_all') }}</option>
                <option value="lost">{{ $t('filter_lost') }}</option>
                <option value="found">{{ $t('filter_found') }}</option>
            </select>
            <select
                class="select select-bordered select-sm bg-base-100"
                :value="param('especie')"
                :aria-label="$t('filter_by_species')"
                @change="setParam('especie', ($event.target as HTMLSelectElement).value)"
            >
                <option value="">{{ $t('filter_all_species') }}</option>
                <option value="dog">{{ $t('filter_dogs') }}</option>
                <option value="cat">{{ $t('filter_cats') }}</option>
                <option value="other">{{ $t('filter_others') }}</option>
            </select>
            <select
                class="select select-bordered select-sm bg-base-100"
                :value="param('resolucion')"
                :aria-label="$t('admin_filter_resolution')"
                @change="setParam('resolucion', ($event.target as HTMLSelectElement).value)"
            >
                <option value="">{{ $t('admin_any_resolution') }}</option>
                <option value="open">{{ $t('admin_resolution_open') }}</option>
                <option value="reunited">{{ $t('status_reunited') }}</option>
            </select>
            <label class="input input-sm input-bordered flex min-w-48 flex-1 items-center gap-2 bg-base-100">
                <Icon name="mdi:magnify" aria-hidden="true" />
                <input
                    v-model="search"
                    type="search"
                    class="grow"
                    :placeholder="$t('admin_search_placeholder')"
                    :aria-label="$t('search_label')"
                />
            </label>
        </div>

        <div v-if="error || actionError" class="alert alert-error" role="alert">{{ $t('error_try_later') }}</div>

        <div class="surface overflow-hidden" :class="{ 'opacity-60': status === 'pending' }">
            <EmptyState
                v-if="status !== 'pending' && !pets.length"
                icon="mdi:paw-off-outline"
                :title="$t('no_results')"
            />
            <ul v-else class="divide-y divide-base-300/70">
                <li
                    v-for="pet in pets"
                    :key="pet.id"
                    class="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap sm:gap-4"
                >
                    <NuxtLink :to="`/admin/mascotas/${pet.id}`" class="flex min-w-0 flex-1 items-center gap-3">
                        <img
                            :src="pet.images[0]"
                            alt=""
                            class="h-14 w-14 shrink-0 rounded-xl bg-base-200 object-cover"
                            loading="lazy"
                        />
                        <span class="min-w-0">
                            <span class="block truncate font-bold">{{ title(pet) }}</span>
                            <span class="block truncate text-sm text-muted"
                                >{{ pet.location }} · {{ pet.description }}</span
                            >
                        </span>
                    </NuxtLink>
                    <div class="flex flex-wrap items-center gap-2">
                        <PetStatusBadge :pet="pet" />
                        <AdminModerationBadge :status="pet.moderationStatus" />
                        <span class="hidden whitespace-nowrap text-xs text-muted lg:inline">
                            {{ dateFormat.format(new Date(pet.createdAt)) }}
                        </span>
                    </div>
                    <div class="flex gap-1">
                        <button
                            v-if="pet.moderationStatus === 'pending_review'"
                            type="button"
                            class="btn btn-success btn-sm text-white"
                            :disabled="busy === pet.id"
                            @click="moderate(pet, 'approved')"
                        >
                            <Icon name="mdi:check" /> {{ $t('admin_publish') }}
                        </button>
                        <button
                            v-else
                            type="button"
                            class="btn btn-ghost btn-sm"
                            :disabled="busy === pet.id"
                            :title="$t('admin_hide_hint')"
                            @click="moderate(pet, 'pending_review')"
                        >
                            <Icon name="mdi:eye-off-outline" /> {{ $t('admin_hide') }}
                        </button>
                        <NuxtLink :to="`/admin/mascotas/${pet.id}`" class="btn btn-outline btn-sm">
                            <Icon name="mdi:pencil" /> {{ $t('admin_edit') }}
                        </NuxtLink>
                    </div>
                </li>
            </ul>
        </div>

        <div v-if="nextCursor" class="text-center">
            <button type="button" class="btn btn-outline" :disabled="loadingMore" @click="loadMore">
                <span v-if="loadingMore" class="loading loading-spinner loading-sm" />
                {{ $t('load_more') }}
            </button>
        </div>
    </div>
</template>
