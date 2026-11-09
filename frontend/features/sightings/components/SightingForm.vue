<script setup lang="ts">
    import { SIGHTING_LIMITS, type SightingDto } from '~~/contracts/sightings'

    const props = defineProps<{ petId: string }>()
    const emit = defineEmits<{ created: [sighting: SightingDto]; cancel: [] }>()

    const { t } = useI18n()
    const api = useSightingsApi()
    const petsApi = usePetsApi()
    const { photos, add, remove } = usePhotoSelection(SIGHTING_LIMITS.maxImages)

    const now = new Date()
    const form = reactive({ description: '', area: '', seenAt: toDateTimeLocal(now) })
    const maxSeenAt = toDateTimeLocal(now)
    const submitting = ref(false)
    const error = ref<string | null>(null)
    const ids = { description: useId(), area: useId(), seenAt: useId(), photos: useId() }
    // Photos already uploaded in a failed attempt are reused, so a retry does not upload them again.
    const uploaded = new Map<File, string>()

    const errorMessage = (cause: unknown) => {
        switch (apiErrorCode(cause)) {
            case 'content_rejected':
                return t('sighting_error_rejected')
            case 'rate_limited':
                return t('sighting_error_rate_limited')
            case 'validation':
                return t('sighting_error_validation')
            case 'unauthorized':
                return t('sighting_error_unauthorized')
            case 'conflict':
                return t('sighting_error_closed')
            default:
                return t('sighting_error_generic')
        }
    }

    const submit = async () => {
        const seenAt = fromDateTimeLocal(form.seenAt)
        if (!seenAt) {
            error.value = t('sighting_error_validation')
            return
        }
        submitting.value = true
        error.value = null
        try {
            const images: string[] = []
            for (const photo of photos.value) {
                const url = uploaded.get(photo.file) ?? (await petsApi.uploadImage(await resizeImage(photo.file, 1600)))
                uploaded.set(photo.file, url)
                images.push(url)
            }
            emit('created', await api.report(props.petId, { ...form, seenAt, images }))
        } catch (cause) {
            error.value = errorMessage(cause)
        } finally {
            submitting.value = false
        }
    }
</script>

<template>
    <form class="surface space-y-4 p-4" @submit.prevent="submit">
        <div class="form-control">
            <label :for="ids.description" class="label font-semibold">{{ t('sighting_description_label') }}</label>
            <textarea
                :id="ids.description"
                v-model="form.description"
                class="textarea textarea-bordered min-h-24"
                :minlength="SIGHTING_LIMITS.descriptionMinLength"
                :maxlength="SIGHTING_LIMITS.descriptionMaxLength"
                :placeholder="t('sighting_description_placeholder')"
                required
            />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
            <div class="form-control">
                <label :for="ids.area" class="label font-semibold">{{ t('sighting_area_label') }}</label>
                <input
                    :id="ids.area"
                    v-model="form.area"
                    type="text"
                    class="input input-bordered"
                    :minlength="SIGHTING_LIMITS.areaMinLength"
                    :maxlength="SIGHTING_LIMITS.areaMaxLength"
                    :aria-describedby="`${ids.area}-hint`"
                    required
                />
                <p :id="`${ids.area}-hint`" class="mt-1 text-xs text-muted">{{ t('sighting_area_hint') }}</p>
            </div>
            <div class="form-control">
                <label :for="ids.seenAt" class="label font-semibold">{{ t('sighting_seen_at_label') }}</label>
                <input
                    :id="ids.seenAt"
                    v-model="form.seenAt"
                    type="datetime-local"
                    class="input input-bordered"
                    :max="maxSeenAt"
                    required
                />
            </div>
        </div>

        <div>
            <label :for="ids.photos" class="label font-semibold">
                {{ t('sighting_photos_label', { max: SIGHTING_LIMITS.maxImages }) }}
            </label>
            <input
                :id="ids.photos"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                multiple
                class="file-input file-input-bordered file-input-sm w-full"
                :disabled="photos.length >= SIGHTING_LIMITS.maxImages"
                @change="add(($event.target as HTMLInputElement).files)"
            />
            <ul v-if="photos.length" class="mt-2 flex gap-2">
                <li v-for="(photo, index) in photos" :key="photo.preview" class="relative">
                    <img
                        :src="photo.preview"
                        :alt="t('sighting_photo_preview_alt', { n: index + 1 })"
                        class="h-16 w-16 rounded-lg object-cover"
                    />
                    <button
                        type="button"
                        class="btn btn-circle btn-xs absolute -right-2 -top-2"
                        :aria-label="t('sighting_photo_remove', { n: index + 1 })"
                        @click="remove(index)"
                    >
                        <Icon name="mdi:close" />
                    </button>
                </li>
            </ul>
        </div>

        <p class="text-xs text-muted">{{ t('sighting_form_privacy') }}</p>
        <p v-if="error" class="text-sm text-error" role="alert">{{ error }}</p>

        <div class="flex flex-wrap justify-end gap-2">
            <button type="button" class="btn btn-ghost" :disabled="submitting" @click="emit('cancel')">
                {{ t('sighting_cancel') }}
            </button>
            <button type="submit" class="btn btn-primary" :disabled="submitting">
                <span v-if="submitting" class="loading loading-spinner loading-sm" />
                {{ t('sighting_submit') }}
            </button>
        </div>
    </form>
</template>
