<script setup lang="ts">
    import type { SightingDto } from '~~/contracts/sightings'

    const props = defineProps<{ sighting: SightingDto; threshold: number; viewerIsPetOwner: boolean }>()
    const emit = defineEmits<{ updated: [sighting: SightingDto]; deleted: [id: string] }>()

    const { t, locale } = useI18n()
    const api = useSightingsApi()
    const busy = ref(false)
    const error = ref<string | null>(null)

    const seenAt = computed(() =>
        new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
            new Date(props.sighting.seenAt)
        )
    )
    const support = computed(() => sightingSupport(props.sighting, props.threshold))

    const validate = async () => {
        busy.value = true
        error.value = null
        try {
            const updated = await api.validate(props.sighting.id)
            emit('updated', { ...props.sighting, ...updated, authorName: props.sighting.authorName })
        } catch (cause) {
            error.value =
                apiErrorCode(cause) === 'rate_limited' ? t('sighting_error_rate_limited') : t('sighting_validate_error')
        } finally {
            busy.value = false
        }
    }

    const hide = async () => {
        if (!window.confirm(t('sighting_hide_confirm'))) return
        busy.value = true
        error.value = null
        try {
            await api.hide(props.sighting.id)
            emit('deleted', props.sighting.id)
        } catch {
            error.value = t('sighting_hide_error')
        } finally {
            busy.value = false
        }
    }

    const remove = async () => {
        if (!window.confirm(t('sighting_delete_confirm'))) return
        busy.value = true
        error.value = null
        try {
            await api.remove(props.sighting.id)
            emit('deleted', props.sighting.id)
        } catch {
            error.value = t('sighting_delete_error')
        } finally {
            busy.value = false
        }
    }
</script>

<template>
    <article class="surface space-y-3 p-4" :aria-labelledby="`sighting-${sighting.id}`">
        <header class="flex flex-wrap items-center justify-between gap-2">
            <h3 :id="`sighting-${sighting.id}`" class="text-base font-bold">
                <Icon name="mdi:map-marker-radius" size="1.1rem" class="text-primary" />
                {{ sighting.area }}
            </h3>
            <span v-if="sighting.moderationStatus === 'pending_review'" class="badge badge-warning badge-outline gap-1">
                <Icon name="mdi:clock-outline" size="0.9rem" /> {{ t('sighting_pending') }}
            </span>
            <span v-else-if="support.kind === 'owner'" class="badge badge-success gap-1">
                <Icon name="mdi:check-decagram" size="0.9rem" /> {{ t('sighting_verified_owner') }}
            </span>
            <span v-else-if="support.kind === 'community'" class="badge badge-success gap-1">
                <Icon name="mdi:account-group" size="0.9rem" /> {{ t('sighting_verified_community') }}
            </span>
            <span v-else class="badge badge-ghost gap-1">
                {{ t('sighting_progress', { points: support.points, threshold: support.threshold }) }}
            </span>
        </header>

        <p class="text-sm text-muted">
            <time :datetime="sighting.seenAt">{{ seenAt }}</time>
            · {{ sighting.authorName ?? t('sighting_author_deleted') }}
        </p>
        <p class="whitespace-pre-line text-sm leading-relaxed">{{ sighting.description }}</p>

        <ul v-if="sighting.images.length" class="flex gap-2">
            <li v-for="(image, index) in sighting.images" :key="image">
                <a :href="image" target="_blank" rel="noopener">
                    <img
                        :src="image"
                        :alt="t('sighting_photo_alt', { n: index + 1, area: sighting.area })"
                        class="h-20 w-20 rounded-lg object-cover"
                        loading="lazy"
                    />
                </a>
            </li>
        </ul>

        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>

        <footer class="flex flex-wrap items-center gap-2">
            <button
                v-if="sighting.viewer.canValidate"
                type="button"
                class="btn btn-sm"
                :class="viewerIsPetOwner ? 'btn-success' : 'btn-outline'"
                :disabled="busy"
                @click="validate"
            >
                <Icon :name="viewerIsPetOwner ? 'mdi:heart-check' : 'mdi:eye-check'" size="1.1rem" />
                {{ viewerIsPetOwner ? t('sighting_validate_owner') : t('sighting_validate') }}
            </button>
            <span v-else-if="sighting.viewer.hasValidated" class="text-sm text-success">
                <Icon name="mdi:check" /> {{ t('sighting_validated') }}
            </span>
            <button
                v-if="sighting.viewer.canHide"
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="busy"
                @click="hide"
            >
                <Icon name="mdi:eye-off-outline" size="1.1rem" /> {{ t('sighting_hide') }}
            </button>
            <button
                v-if="sighting.viewer.isAuthor"
                type="button"
                class="btn btn-ghost btn-sm text-error"
                :disabled="busy"
                @click="remove"
            >
                <Icon name="mdi:delete-outline" size="1.1rem" /> {{ t('sighting_delete') }}
            </button>
        </footer>
    </article>
</template>
