<template>
    <div class="min-h-screen rounded-sm bg-base-50 p-4 mb-5">
        <div class="max-w-md mx-auto">
            <h1 class="text-4xl font-bold text-center mb-8">{{ $t('register_pet') }}</h1>
            <div v-if="!alert" class="card bg-base-150 shadow-xl">
                <form @submit.prevent="submitForm" class="card-body">
                    <div class="form-control">
                        <label class="label" for="status">
                            <span class="label-text">{{ $t('situation') }}</span>
                        </label>
                        <select v-model="form.reportType" id="status" required class="select select-bordered w-full">
                            <option value="lost">{{ $t('i_lost') }}</option>
                            <option value="found">{{ $t('i_found') }}</option>
                        </select>
                    </div>

                    <div class="form-control">
                        <label class="label" for="type">
                            <span class="label-text"> {{ $t('type') }}</span>
                        </label>
                        <select v-model="form.species" id="type" class="select select-bordered w-full">
                            <option value="dog">{{ $t('dog') }}</option>
                            <option value="cat">{{ $t('cat') }}</option>
                            <option value="other">{{ $t('other') }}</option>
                        </select>
                    </div>

                    <div class="form-control">
                        <label class="label" for="image">
                            <span class="label-text"> {{ $t('images') }}</span>
                        </label>
                        <input
                            type="file"
                            required
                            id="image"
                            @change="handleImageUpload"
                            multiple
                            accept="image/*"
                            class="file-input file-input-bordered w-full"
                        />
                    </div>
                    <button
                        class="btn btn-secondary mt-2"
                        :disabled="files.length === 0 || gptLoading"
                        type="button"
                        v-if="!showAllForm"
                        @click="showAllForm = true"
                    >
                        <span v-if="!gptLoading"> {{ $t('continue') }} <Icon name="mdi:arrow-right" /> </span>
                        <div v-else class="flex justify-center items-center">
                            <span class="loading loading-spinner"></span>
                            {{ $t('analyzing_image') }}
                        </div>
                    </button>
                    <div v-if="showAllForm">
                        <div v-if="gtpError" role="alert" :class="`alert alert-error`">
                            <Icon name="heroicons:exclamation-triangle-20-solid" class="w-6 h-6" />
                            <span>{{ $t('analyzing_image_error') }}</span>
                        </div>
                        <div class="form-control">
                            <label class="label" for="name">
                                <span class="label-text">{{ $t('name_if_known') }}</span>
                            </label>
                            <input v-model="form.name" type="text" id="name" class="input input-bordered" />
                        </div>

                        <div class="form-control">
                            <label class="label" for="description">
                                <span class="label-text"> {{ $t('description') }}</span>
                            </label>

                            <textarea
                                v-model="form.description"
                                id="description"
                                required
                                class="textarea textarea-bordered w-full"
                            ></textarea>
                        </div>

                        <div class="form-control">
                            <label class="label" for="date">
                                <span class="label-text"> {{ $t('date') }}</span>
                            </label>
                            <input
                                v-model="form.eventDate"
                                type="date"
                                id="date"
                                :max="maxDate"
                                required
                                class="input input-bordered"
                            />
                        </div>

                        <div class="form-control">
                            <label class="label" for="location">
                                <span class="label-text"> {{ $t('ubication_name') }}</span>
                            </label>
                            <input
                                v-model="form.location"
                                type="text"
                                id="location"
                                required
                                class="input input-bordered"
                            />
                        </div>

                        <div v-if="form.reportType === 'found'" class="form-control">
                            <span class="label-text">{{ $t('its_alive_question') }}</span>
                            <div class="flex flex-row gap-2">
                                <label class="label justify-start gap-2">
                                    <span class="label-text">{{ $t('yes') }}</span>
                                    <input
                                        v-model="form.alive"
                                        name="alive"
                                        type="radio"
                                        id="alive-yes"
                                        :value="true"
                                        class="radio radio-primary"
                                    />
                                </label>
                                <label class="label justify-start gap-2">
                                    <span class="label-text">{{ $t('no') }}</span>
                                    <input
                                        v-model="form.alive"
                                        name="alive"
                                        type="radio"
                                        id="alive-no"
                                        :value="false"
                                        class="radio radio-primary"
                                    />
                                </label>
                            </div>
                        </div>

                        <div class="form-control">
                            <label class="label" for="contact">
                                <span class="label-text">{{ $t('contact') }} {{ $t('contact_examples') }}</span>
                            </label>
                            <input
                                v-model="form.contact"
                                type="text"
                                id="contact"
                                required
                                class="input input-bordered"
                            />
                        </div>
                        <div class="form-control mt-6">
                            <button type="submit" class="btn btn-primary text-gray-50" :disabled="isSubmitting">
                                {{ isSubmitting ? $t('registering') : $t('register_pet') }}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
            <AlertComponent v-else :alertType="alert.type" :message="alert.message" />
        </div>
    </div>
</template>

<script setup lang="ts">
    import { FetchError } from 'ofetch'
    import { PET_LIMITS, type ApiErrorDto, type ReportPetRequest } from '~~/contracts/pets'
    import AlertComponent from '~/components/AlertComponent.vue'

    interface Alert {
        type: 'error' | 'success'
        message: string
    }

    type PetForm = Omit<ReportPetRequest, 'images'>

    const api = usePetsApi()

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
    const files = ref<File[]>([])

    const isSubmitting = ref(false)
    const alert = ref<Alert | null>(null)
    const showAllForm = ref(false)
    const maxDate = computed(() => new Date().toISOString().split('T')[0])
    const gptLoading = ref(false)
    const gtpError = ref(false)

    const handleImageUpload = async (event: Event) => {
        const target = event.target as HTMLInputElement
        files.value = Array.from(target.files ?? []).slice(0, PET_LIMITS.maxImages)
        if (files.value[0]) await analyzeImage(files.value[0])
    }

    /** Pre-fills the form from the first photo. The user can always correct or complete it. */
    const analyzeImage = async (file: File) => {
        if (gptLoading.value) return
        gptLoading.value = true
        try {
            const image = await blobToDataUrl(await resizeImage(file, 512, 0.7))
            const result = await api.describe(image)
            gtpError.value = !result.isPet
            if (result.isPet) {
                form.value = {
                    ...form.value,
                    species: result.species ?? form.value.species,
                    description: result.description ?? form.value.description,
                    name: result.name ?? form.value.name,
                    location: result.location ?? form.value.location,
                    contact: result.contact ?? form.value.contact,
                    eventDate: result.eventDate ?? form.value.eventDate
                }
            }
        } catch (error) {
            gtpError.value = true
            console.error('Error analyzing image:', error)
        } finally {
            gptLoading.value = false
            showAllForm.value = true
        }
    }

    const submitForm = async () => {
        isSubmitting.value = true
        try {
            const resized = await Promise.all(files.value.map(file => resizeImage(file, 1600)))
            const images = await Promise.all(resized.map(image => api.uploadImage(image)))
            const pet = await api.report({ ...form.value, images })

            alert.value = {
                type: 'success',
                message:
                    pet.moderationStatus === 'approved'
                        ? 'Se ha registrado correctamente la mascota'
                        : 'Hemos recibido el aviso. Lo revisaremos antes de publicarlo.'
            }
        } catch (error) {
            console.error('Error saving pet:', error)
            alert.value = { type: 'error', message: errorMessage(error) }
        } finally {
            isSubmitting.value = false
            window.scrollTo(0, 0)
        }
    }

    function errorMessage(error: unknown): string {
        const apiError = error instanceof FetchError ? (error.data as ApiErrorDto | undefined)?.error : undefined
        switch (apiError?.code) {
            case 'validation':
                return 'Revisa los datos del formulario, alguno no es válido'
            case 'content_rejected':
                return 'El aviso no parece de una mascota perdida o encontrada, así que no se ha publicado'
            case 'rate_limited':
                return 'Has enviado demasiados avisos seguidos. Inténtalo de nuevo más tarde'
            default:
                return 'Ha ocurrido un error, por favor, inténtelo de nuevo'
        }
    }
</script>

<style>
    .loader {
        border: 4px solid rgba(0, 0, 0, 0.1);
        border-left-color: #000;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
