<script setup lang="ts">
    import type { SightingDto } from '~~/contracts/sightings'

    const props = defineProps<{ petId: string; open: boolean }>()

    const { t } = useI18n()
    const { loggedIn } = useUserSession()
    const route = useRoute()
    const api = useSightingsApi()
    // Depends on who is viewing (own pending sightings, validations), so it is not part of the SSR payload.
    const { data, pending, error, refresh } = await useAsyncData(
        `sightings-${props.petId}`,
        () => api.list(props.petId),
        {
            server: false,
            lazy: true
        }
    )

    const showForm = ref(false)
    const notice = ref<string | null>(null)

    const replace = (updated: SightingDto) => {
        if (!data.value) return
        data.value = {
            ...data.value,
            items: data.value.items.map(item => (item.id === updated.id ? updated : item))
        }
    }
    const removeItem = (id: string) => {
        if (data.value) data.value = { ...data.value, items: data.value.items.filter(item => item.id !== id) }
    }
    const created = async (sighting: SightingDto) => {
        showForm.value = false
        notice.value = sighting.moderationStatus === 'approved' ? t('sighting_published') : t('sighting_sent_to_review')
        await refresh()
    }
</script>

<template>
    <section class="space-y-4" aria-labelledby="sightings-title">
        <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
                <h2 id="sightings-title" class="text-lg">{{ t('sightings_title') }}</h2>
                <p class="text-sm text-muted">{{ t('sightings_hint') }}</p>
            </div>
            <template v-if="open && !showForm">
                <button v-if="loggedIn" type="button" class="btn btn-primary btn-sm" @click="showForm = true">
                    <Icon name="mdi:eye-plus-outline" size="1.1rem" /> {{ t('sighting_add') }}
                </button>
                <LoginButton v-else class="btn-sm btn-outline" :return-to="route.fullPath" label="sighting_login" />
            </template>
        </div>

        <p class="alert alert-warning text-sm">
            <Icon name="mdi:shield-alert-outline" size="1.25rem" />
            <span>{{ t('sightings_scam_warning') }}</span>
        </p>

        <div v-if="notice" class="alert alert-info text-sm" role="status">
            <Icon name="mdi:information-outline" size="1.25rem" />
            <span>{{ notice }}</span>
        </div>

        <SightingForm v-if="showForm" :pet-id="petId" @created="created" @cancel="showForm = false" />

        <div v-if="pending" class="skeleton h-24 w-full" />
        <p v-else-if="error" class="text-sm text-error" role="alert">{{ t('sightings_load_error') }}</p>
        <template v-else-if="data">
            <p v-if="data.viewerIsPetOwner && data.items.length" class="text-sm text-muted">
                {{ t('sightings_owner_hint') }}
            </p>
            <ul v-if="data.items.length" class="space-y-3">
                <li v-for="sighting in data.items" :key="sighting.id">
                    <SightingCard
                        :sighting="sighting"
                        :threshold="data.threshold"
                        :viewer-is-pet-owner="data.viewerIsPetOwner"
                        @updated="replace"
                        @deleted="removeItem"
                    />
                </li>
            </ul>
            <p v-else class="text-sm text-muted">{{ t('sightings_empty') }}</p>
        </template>
    </section>
</template>
