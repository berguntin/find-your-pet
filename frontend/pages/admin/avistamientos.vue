<script setup lang="ts">
    import type { AdminSightingDto } from '~~/contracts/sightings'
    import type { ModeratePetRequest } from '~~/contracts/admin'

    definePageMeta({ layout: 'admin', middleware: 'admin' })

    const { t, locale } = useI18n()
    useHead({ title: () => t('admin_sightings_title') })

    const api = useAdminApi()
    const status = ref<AdminSightingDto['moderationStatus']>('pending_review')
    const { data, error, refresh } = await useAsyncData('admin-sightings', () => api.listSightings(status.value), {
        watch: [status]
    })
    const busyId = ref<string | null>(null)
    const actionError = ref<string | null>(null)

    const statuses = [
        { value: 'pending_review', label: 'admin_status_pending_review' },
        { value: 'approved', label: 'admin_status_approved' }
    ] as const

    const formatDate = (value: string) =>
        new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

    const decide = async (sighting: AdminSightingDto, decision: ModeratePetRequest['status']) => {
        if (decision === 'rejected' && !window.confirm(t('admin_sighting_reject_confirm'))) return
        busyId.value = sighting.id
        actionError.value = null
        try {
            await api.moderateSighting(sighting.id, decision)
            await refresh()
        } catch {
            actionError.value = t('admin_sighting_action_error')
        } finally {
            busyId.value = null
        }
    }
</script>

<template>
    <div class="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div>
            <h1 class="text-2xl">{{ t('admin_sightings_title') }}</h1>
            <p class="text-sm text-muted">{{ t('admin_sightings_hint') }}</p>
        </div>

        <div class="join" role="group">
            <button
                v-for="option in statuses"
                :key="option.value"
                type="button"
                class="btn join-item btn-sm"
                :class="{ 'btn-active': status === option.value }"
                :aria-pressed="status === option.value"
                @click="status = option.value"
            >
                {{ t(option.label) }}
            </button>
        </div>

        <p v-if="actionError" class="text-sm text-error" role="alert">{{ actionError }}</p>
        <p v-if="error" class="text-sm text-error" role="alert">{{ t('admin_sightings_load_error') }}</p>
        <p v-else-if="!data?.items.length" class="text-sm text-muted">{{ t('admin_sightings_empty') }}</p>

        <ul v-else class="space-y-4">
            <li
                v-for="sighting in data.items"
                :key="sighting.id"
                class="surface grid gap-4 p-4 md:grid-cols-[1fr_16rem]"
            >
                <div class="space-y-2">
                    <p class="text-sm text-muted">
                        {{ t('admin_sighting_seen_at', { date: formatDate(sighting.seenAt), area: sighting.area }) }}
                        · {{ t('admin_sighting_points', { points: sighting.points }) }}
                        <span v-if="sighting.verified" class="badge badge-success badge-sm">
                            {{ t('admin_sighting_verified') }}
                        </span>
                    </p>
                    <p class="whitespace-pre-line text-sm">{{ sighting.description }}</p>
                    <ul v-if="sighting.images.length" class="flex gap-2">
                        <li v-for="(image, index) in sighting.images" :key="image">
                            <a :href="image" target="_blank" rel="noopener">
                                <img
                                    :src="image"
                                    :alt="t('admin_sighting_photo_alt', { n: index + 1 })"
                                    class="h-20 w-20 rounded-lg object-cover"
                                />
                            </a>
                        </li>
                    </ul>
                    <div class="flex flex-wrap gap-2 pt-2">
                        <NuxtLink :to="`/mascota/${sighting.petId}`" class="btn btn-ghost btn-sm" target="_blank">
                            <Icon name="mdi:open-in-new" /> {{ t('admin_sighting_view_pet') }}
                        </NuxtLink>
                        <button
                            v-if="sighting.moderationStatus === 'pending_review'"
                            type="button"
                            class="btn btn-success btn-sm"
                            :disabled="busyId === sighting.id"
                            @click="decide(sighting, 'approved')"
                        >
                            {{ t('admin_sighting_approve') }}
                        </button>
                        <button
                            v-else
                            type="button"
                            class="btn btn-outline btn-sm"
                            :disabled="busyId === sighting.id"
                            @click="decide(sighting, 'pending_review')"
                        >
                            {{ t('admin_sighting_hide') }}
                        </button>
                        <button
                            type="button"
                            class="btn btn-error btn-outline btn-sm"
                            :disabled="busyId === sighting.id"
                            @click="decide(sighting, 'rejected')"
                        >
                            {{ t('admin_sighting_reject') }}
                        </button>
                    </div>
                </div>
                <AdminModerationScores :scores="sighting.moderationScores" />
            </li>
        </ul>
    </div>
</template>
