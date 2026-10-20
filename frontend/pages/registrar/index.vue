<script setup lang="ts">
    import { FetchError } from 'ofetch'
    import {
        PET_LIMITS,
        type ApiErrorDto,
        type PetDto,
        type PetMatchDto,
        type ReportPetRequest
    } from '~~/contracts/pets'

    const { t } = useI18n()
    useHead(() => ({ title: `${t('publish_report')} · ${t('app_name')}` }))

    type PetForm = Omit<ReportPetRequest, 'images'>
    interface Photo {
        file: File
        preview: string
    }

    const api = usePetsApi()

    const step = ref<1 | 2>(1)
    const form = ref<PetForm>({
        reportType: 'lost',
        species: 'dog',
        name: '',
        description: '',
        location: '',
        contact: '',
        alive: true,
        eventDate: ''
    })
    const photos = ref<Photo[]>([])
    const dragging = ref(false)
    const maxDate = new Date().toISOString().split('T')[0]

    const analyzing = ref(false)
    const analysis = ref<'filled' | 'failed' | null>(null)
    let analyzedFile: File | null = null

    /**
     * From this match a published pet may be the same animal, so it is worth checking first. With the
     * calibration from scripts/eval-embeddings.ts (floor 0.70, ceiling 0.85) it is a similarity of 0.775:
     * most photos of the same animal reach it and about 95% of different animals stay below.
     * It is only a hint, so a false positive costs little.
     */
    const SIMILAR_PET_MIN_MATCH = 50
    const similarPets = ref<PetMatchDto[]>([])

    const submitting = ref(false)
    const progress = ref('')
    const submitError = ref<string | null>(null)
    const published = ref<PetDto | null>(null)

    const reportTypes = [
        { value: 'lost', icon: 'mdi:magnify', title: 'i_lost', hint: 'i_lost_hint' },
        { value: 'found', icon: 'mdi:hand-heart-outline', title: 'i_found', hint: 'i_found_hint' }
    ] as const
    const speciesOptions = [
        { value: 'dog', icon: 'mdi:dog' },
        { value: 'cat', icon: 'mdi:cat' },
        { value: 'other', icon: 'mdi:rabbit' }
    ] as const

    const addFiles = (files: FileList | File[] | null | undefined) => {
        const images = Array.from(files ?? []).filter(file => file.type.startsWith('image/'))
        const room = PET_LIMITS.maxImages - photos.value.length
        photos.value.push(...images.slice(0, room).map(file => ({ file, preview: URL.createObjectURL(file) })))
    }

    const removePhoto = (index: number) => {
        const [removed] = photos.value.splice(index, 1)
        if (removed) URL.revokeObjectURL(removed.preview)
    }

    /** The first photo is the main one: it is shown on cards and used to pre-fill the details. */
    const setMainPhoto = (index: number) => {
        const [photo] = photos.value.splice(index, 1)
        if (photo) photos.value.unshift(photo)
    }

    const onDrop = (event: DragEvent) => {
        dragging.value = false
        addFiles(event.dataTransfer?.files)
    }

    onBeforeUnmount(() => photos.value.forEach(photo => URL.revokeObjectURL(photo.preview)))

    /** Pre-fills the details from the main photo and looks for published pets that may be the same animal. */
    const goToDetails = async () => {
        const main = photos.value[0]?.file
        if (!main) return
        if (main !== analyzedFile) {
            analyzing.value = true
            await Promise.all([prefillFromPhoto(main), findSimilarPets(main)])
            analyzedFile = main
            analyzing.value = false
        }
        step.value = 2
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    /** The user can always correct or complete what the photo gives. */
    const prefillFromPhoto = async (file: File) => {
        try {
            const result = await api.describe(await blobToDataUrl(await resizeImage(file, 512, 0.7)))
            analysis.value = result.isPet ? 'filled' : 'failed'
            if (result.isPet) {
                form.value = {
                    ...form.value,
                    species: result.species ?? form.value.species,
                    description: form.value.description || result.description || '',
                    name: form.value.name || result.name || '',
                    location: form.value.location || result.location || '',
                    contact: form.value.contact || result.contact || '',
                    eventDate: form.value.eventDate || result.eventDate || ''
                }
            }
        } catch {
            analysis.value = 'failed'
        }
    }

    /** A hint only: if the search is unavailable or fails, the report goes on as usual. */
    const findSimilarPets = async (file: File) => {
        try {
            const { items } = await api.searchByImage(await blobToDataUrl(await resizeImage(file, 768, 0.8)))
            similarPets.value = items.filter(item => item.match >= SIMILAR_PET_MIN_MATCH).slice(0, 3)
        } catch {
            similarPets.value = []
        }
    }

    const submitForm = async () => {
        submitting.value = true
        submitError.value = null
        try {
            const urls: string[] = []
            for (const [index, photo] of photos.value.entries()) {
                progress.value = t('uploading_photo', { n: index + 1, total: photos.value.length })
                urls.push(await api.uploadImage(await resizeImage(photo.file, 1600)))
            }
            progress.value = t('publishing')
            published.value = await api.report({ ...form.value, images: urls })
            window.scrollTo({ top: 0, behavior: 'smooth' })
        } catch (error) {
            console.error('Error saving pet:', error)
            submitError.value = errorMessage(error)
        } finally {
            submitting.value = false
            progress.value = ''
        }
    }

    const startOver = () => {
        photos.value.forEach(photo => URL.revokeObjectURL(photo.preview))
        photos.value = []
        form.value = { ...form.value, name: '', description: '', location: '', eventDate: '', alive: true }
        published.value = null
        analysis.value = null
        similarPets.value = []
        analyzedFile = null
        step.value = 1
    }

    function errorMessage(error: unknown): string {
        const apiError = error instanceof FetchError ? (error.data as ApiErrorDto | undefined)?.error : undefined
        switch (apiError?.code) {
            case 'validation':
                return t('error_validation')
            case 'content_rejected':
                return t('error_content_rejected')
            case 'rate_limited':
                return t('error_rate_limited')
            default:
                return t('error_try_later')
        }
    }
</script>

<template>
    <div class="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <!-- Done -->
        <div v-if="published" class="surface flex flex-col items-center gap-4 px-6 py-12 text-center">
            <span
                class="grid h-16 w-16 place-items-center rounded-full text-white"
                :class="published.moderationStatus === 'approved' ? 'bg-found' : 'bg-reunited'"
            >
                <Icon
                    :name="published.moderationStatus === 'approved' ? 'mdi:check' : 'mdi:clock-outline'"
                    size="2rem"
                />
            </span>
            <h1 class="text-2xl sm:text-3xl">
                {{ published.moderationStatus === 'approved' ? $t('published_title') : $t('pending_title') }}
            </h1>
            <p class="max-w-md text-muted">
                {{ published.moderationStatus === 'approved' ? $t('published_text') : $t('pending_text') }}
            </p>
            <div class="mt-2 flex flex-wrap justify-center gap-2">
                <NuxtLink
                    v-if="published.moderationStatus === 'approved'"
                    :to="{ name: 'mascota-id', params: { id: published.id } }"
                    class="btn btn-primary"
                >
                    {{ $t('view_report') }}
                </NuxtLink>
                <NuxtLink to="/" class="btn btn-ghost">{{ $t('back_to_reports') }}</NuxtLink>
                <button class="btn btn-ghost" @click="startOver">{{ $t('publish_another') }}</button>
            </div>
        </div>

        <template v-else>
            <h1 class="text-3xl sm:text-4xl">{{ $t('publish_report') }}</h1>
            <p class="mt-2 text-muted">{{ $t('form_intro') }}</p>

            <ul class="steps mt-6 w-full">
                <li class="step" :class="{ 'step-primary': step >= 1 }">{{ $t('step_photos') }}</li>
                <li class="step" :class="{ 'step-primary': step >= 2 }">{{ $t('step_details') }}</li>
            </ul>

            <!-- Step 1: what happened and photos -->
            <div v-if="step === 1" class="mt-6 space-y-6">
                <fieldset>
                    <legend class="mb-3 font-bold">{{ $t('what_happened') }}</legend>
                    <div class="grid gap-3 sm:grid-cols-2">
                        <label
                            v-for="option in reportTypes"
                            :key="option.value"
                            class="surface flex cursor-pointer items-start gap-3 p-4 transition"
                            :class="
                                form.reportType === option.value ? 'ring-2 ring-primary' : 'hover:ring-base-content/20'
                            "
                        >
                            <input v-model="form.reportType" type="radio" :value="option.value" class="sr-only" />
                            <Icon :name="option.icon" size="1.75rem" class="text-primary" />
                            <span>
                                <span class="block font-bold">{{ $t(option.title) }}</span>
                                <span class="block text-sm text-muted">{{ $t(option.hint) }}</span>
                            </span>
                        </label>
                    </div>
                </fieldset>

                <fieldset>
                    <legend class="mb-3 font-bold">{{ $t('which_animal') }}</legend>
                    <div class="flex flex-wrap gap-2">
                        <label
                            v-for="option in speciesOptions"
                            :key="option.value"
                            class="btn rounded-full"
                            :class="
                                form.species === option.value
                                    ? 'btn-neutral'
                                    : 'btn-ghost bg-white ring-1 ring-base-300'
                            "
                        >
                            <input v-model="form.species" type="radio" :value="option.value" class="sr-only" />
                            <Icon :name="option.icon" size="1.25rem" /> {{ $t(option.value) }}
                        </label>
                    </div>
                </fieldset>

                <fieldset>
                    <legend class="mb-1 font-bold">{{ $t('photos') }}</legend>
                    <p class="mb-3 text-sm text-muted">{{ $t('photos_hint', { max: PET_LIMITS.maxImages }) }}</p>
                    <label
                        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-box border-2 border-dashed px-6 py-10 text-center transition"
                        :class="
                            dragging
                                ? 'border-primary bg-primary/5'
                                : 'border-base-300 bg-white hover:border-primary/60'
                        "
                        @dragover.prevent="dragging = true"
                        @dragleave.prevent="dragging = false"
                        @drop.prevent="onDrop"
                    >
                        <Icon name="mdi:camera-plus-outline" size="2.25rem" class="text-primary" />
                        <span class="font-semibold">{{ $t('add_photos') }}</span>
                        <span class="text-sm text-muted">{{ $t('add_photos_hint') }}</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            class="sr-only"
                            :disabled="photos.length >= PET_LIMITS.maxImages"
                            @change="event => addFiles((event.target as HTMLInputElement).files)"
                        />
                    </label>
                    <ul v-if="photos.length" class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                        <li v-for="(photo, index) in photos" :key="photo.preview" class="relative aspect-square">
                            <button
                                type="button"
                                class="block h-full w-full rounded-xl"
                                :class="index === 0 ? 'ring-2 ring-primary ring-offset-2' : 'opacity-90 hover:opacity-100'"
                                :aria-label="index === 0 ? $t('main_photo') : $t('set_main_photo')"
                                :aria-pressed="index === 0"
                                :title="index === 0 ? $t('main_photo') : $t('set_main_photo')"
                                @click="setMainPhoto(index)"
                            >
                                <img :src="photo.preview" alt="" class="h-full w-full rounded-xl object-cover" />
                            </button>
                            <span
                                class="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 rounded-full px-2 text-xs"
                                :class="index === 0 ? 'bg-primary text-primary-content' : 'bg-neutral/60 text-neutral-content'"
                            >
                                <Icon :name="index === 0 ? 'mdi:star' : 'mdi:star-outline'" />
                                <template v-if="index === 0">{{ $t('main_photo') }}</template>
                            </span>
                            <button
                                type="button"
                                class="btn btn-circle btn-xs absolute -right-2 -top-2 shadow"
                                :aria-label="$t('remove_photo')"
                                @click="removePhoto(index)"
                            >
                                <Icon name="mdi:close" />
                            </button>
                        </li>
                    </ul>
                </fieldset>

                <button
                    type="button"
                    class="btn btn-primary btn-block btn-lg"
                    :disabled="photos.length === 0 || analyzing"
                    @click="goToDetails"
                >
                    <template v-if="analyzing">
                        <span class="loading loading-spinner" /> {{ $t('analyzing_image') }}
                    </template>
                    <template v-else>{{ $t('continue') }} <Icon name="mdi:arrow-right" /></template>
                </button>
            </div>

            <!-- Step 2: details and contact -->
            <form v-else class="mt-6 space-y-5" @submit.prevent="submitForm">
                <section v-if="similarPets.length" role="status" class="surface space-y-3 p-4 ring-2 ring-accent">
                    <div class="flex items-start gap-3">
                        <Icon name="mdi:paw" size="1.5rem" class="shrink-0 text-accent" />
                        <div>
                            <h2 class="font-bold">{{ $t('similar_pets_title') }}</h2>
                            <p class="text-sm text-muted">{{ $t('similar_pets_text') }}</p>
                        </div>
                    </div>
                    <ul class="space-y-2">
                        <li v-for="{ pet, match } in similarPets" :key="pet.id">
                            <NuxtLink
                                :to="{ name: 'mascota-id', params: { id: pet.id } }"
                                target="_blank"
                                class="flex items-center gap-3 rounded-xl bg-base-200/60 p-2 transition hover:bg-base-200"
                            >
                                <img
                                    :src="pet.images[0]"
                                    alt=""
                                    class="h-14 w-14 shrink-0 rounded-lg object-cover"
                                    :class="{ 'blur-sm': !pet.alive }"
                                />
                                <span class="min-w-0 flex-1">
                                    <span class="block truncate font-semibold">
                                        {{ pet.name || $t(`unnamed_${pet.species}`) }}
                                    </span>
                                    <span class="block truncate text-sm text-muted">
                                        {{ $t(pet.reportType === 'lost' ? 'status_lost' : 'status_found') }} · {{ pet.location }}
                                    </span>
                                </span>
                                <span class="shrink-0 text-sm font-extrabold text-accent">
                                    {{ $t('match_percentage', { match }) }}
                                </span>
                                <Icon name="mdi:open-in-new" class="shrink-0 text-muted" />
                            </NuxtLink>
                        </li>
                    </ul>
                    <p class="text-sm text-muted">{{ $t('similar_pets_continue') }}</p>
                </section>

                <div v-if="analysis === 'filled'" role="status" class="alert bg-base-200">
                    <Icon name="mdi:auto-fix" size="1.5rem" class="text-primary" />
                    <span>{{ $t('analysis_filled') }}</span>
                </div>
                <div v-else-if="analysis === 'failed'" role="status" class="alert bg-base-200">
                    <Icon name="mdi:information-outline" size="1.5rem" />
                    <span>{{ $t('analyzing_image_error') }}</span>
                </div>

                <label class="form-control">
                    <span class="label-text mb-1 font-bold">{{ $t('description') }} *</span>
                    <textarea
                        v-model="form.description"
                        required
                        rows="4"
                        :maxlength="PET_LIMITS.descriptionMaxLength"
                        class="textarea textarea-bordered rounded-2xl bg-white text-base"
                        :placeholder="$t('description_placeholder')"
                    />
                    <span class="label-text-alt mt-1 text-muted">{{ $t('description_hint') }}</span>
                </label>

                <div class="grid gap-5 sm:grid-cols-2">
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('name_if_known') }}</span>
                        <input
                            v-model="form.name"
                            type="text"
                            :maxlength="PET_LIMITS.nameMaxLength"
                            class="input input-bordered bg-white"
                        />
                    </label>
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">
                            {{ form.reportType === 'lost' ? $t('lost_on') : $t('found_on') }} *
                        </span>
                        <input
                            v-model="form.eventDate"
                            type="date"
                            :max="maxDate"
                            required
                            class="input input-bordered bg-white"
                        />
                    </label>
                </div>

                <label class="form-control">
                    <span class="label-text mb-1 font-bold">{{ $t('ubication_name') }} *</span>
                    <input
                        v-model="form.location"
                        type="text"
                        required
                        :maxlength="PET_LIMITS.locationMaxLength"
                        class="input input-bordered bg-white"
                        :placeholder="$t('location_placeholder')"
                    />
                </label>

                <fieldset v-if="form.reportType === 'found'">
                    <legend class="mb-2 font-bold">{{ $t('its_alive_question') }}</legend>
                    <div class="flex gap-2">
                        <label
                            v-for="option in [true, false]"
                            :key="String(option)"
                            class="btn rounded-full"
                            :class="form.alive === option ? 'btn-neutral' : 'btn-ghost bg-white ring-1 ring-base-300'"
                        >
                            <input v-model="form.alive" type="radio" :value="option" class="sr-only" />
                            {{ option ? $t('yes') : $t('no') }}
                        </label>
                    </div>
                </fieldset>

                <label class="form-control">
                    <span class="label-text mb-1 font-bold">{{ $t('contact') }} *</span>
                    <input
                        v-model="form.contact"
                        type="text"
                        required
                        :maxlength="PET_LIMITS.contactMaxLength"
                        class="input input-bordered bg-white"
                        :placeholder="$t('contact_placeholder')"
                    />
                    <span class="label-text-alt mt-1 text-muted">{{ $t('contact_public_hint') }}</span>
                </label>

                <div v-if="submitError" role="alert" class="alert alert-error">
                    <Icon name="mdi:alert-circle-outline" size="1.5rem" />
                    <span>{{ submitError }}</span>
                </div>

                <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                    <button type="button" class="btn btn-ghost" :disabled="submitting" @click="step = 1">
                        <Icon name="mdi:arrow-left" /> {{ $t('back') }}
                    </button>
                    <button type="submit" class="btn btn-primary btn-lg" :disabled="submitting">
                        <span v-if="submitting" class="loading loading-spinner" />
                        {{ submitting ? progress : $t('publish_report') }}
                    </button>
                </div>
            </form>
        </template>
    </div>
</template>
