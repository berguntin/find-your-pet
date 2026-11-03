<script setup lang="ts">
    import { PET_LIMITS, type PetDto, type PetMatchDto, type ReportPetRequest } from '~~/contracts/pets'

    const { t } = useI18n()
    useHead(() => ({ title: `${t('publish_report')} · ${t('app_name')}` }))

    type PetForm = Omit<ReportPetRequest, 'images'>

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
    const {
        photos,
        add: addPhotos,
        remove: removePhoto,
        setMain: setMainPhoto,
        clear: clearPhotos
    } = usePhotoSelection(PET_LIMITS.maxImages)
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
        clearPhotos()
        form.value = { ...form.value, name: '', description: '', location: '', eventDate: '', alive: true }
        published.value = null
        analysis.value = null
        similarPets.value = []
        analyzedFile = null
        step.value = 1
    }

    function errorMessage(error: unknown): string {
        switch (apiErrorCode(error)) {
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
        <ReportDone v-if="published" :pet="published" @start-over="startOver" />

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

                <ReportPhotoPicker
                    :photos="photos"
                    :max="PET_LIMITS.maxImages"
                    @add="addPhotos"
                    @remove="removePhoto"
                    @set-main="setMainPhoto"
                />

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
                <SimilarPetsNotice v-if="similarPets.length" :matches="similarPets" />

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
