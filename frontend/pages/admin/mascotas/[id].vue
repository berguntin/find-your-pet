<script setup lang="ts">
    import type { AdminPetDto, AdminUpdatePetRequest } from '~~/contracts/admin'
    import { PET_LIMITS } from '~~/contracts/pets'

    definePageMeta({ layout: 'admin', middleware: 'admin' })

    const { t, locale } = useI18n()
    const route = useRoute()
    const id = String(route.params.id)
    const api = useAdminApi()
    const petsApi = usePetsApi()

    const { data: pet, error } = await useAsyncData(`admin-pet-${id}`, () => api.getPet(id))
    useHead({ title: () => pet.value?.name || t('admin_edit') })

    /** A photo already stored (url) or one picked now and uploaded on save (file). */
    interface EditablePhoto {
        url?: string
        file?: File
        preview: string
    }

    const form = reactive({
        reportType: 'lost' as AdminPetDto['reportType'],
        species: 'dog' as AdminPetDto['species'],
        name: '',
        description: '',
        location: '',
        contact: '',
        alive: true,
        eventDate: '',
        resolution: 'open' as AdminPetDto['resolution']
    })
    const photos = ref<EditablePhoto[]>([])

    const reset = (value: AdminPetDto) => {
        Object.assign(form, {
            reportType: value.reportType,
            species: value.species,
            name: value.name ?? '',
            description: value.description,
            location: value.location,
            contact: value.contact,
            alive: value.alive,
            eventDate: value.eventDate,
            resolution: value.resolution
        })
        photos.value.forEach(photo => photo.file && URL.revokeObjectURL(photo.preview))
        photos.value = value.images.map(url => ({ url, preview: url }))
    }
    watch(pet, value => value && reset(value), { immediate: true })
    onBeforeUnmount(() => photos.value.forEach(photo => photo.file && URL.revokeObjectURL(photo.preview)))

    const addPhotos = (files: FileList | null) => {
        const room = PET_LIMITS.maxImages - photos.value.length
        const images = Array.from(files ?? []).filter(file => file.type.startsWith('image/'))
        photos.value.push(...images.slice(0, room).map(file => ({ file, preview: URL.createObjectURL(file) })))
    }
    const removePhoto = (index: number) => {
        const [removed] = photos.value.splice(index, 1)
        if (removed?.file) URL.revokeObjectURL(removed.preview)
    }
    const setMainPhoto = (index: number) => {
        const [photo] = photos.value.splice(index, 1)
        if (photo) photos.value.unshift(photo)
    }

    const saving = ref(false)
    const saved = ref(false)
    const saveError = ref<string | null>(null)

    const discard = () => {
        if (pet.value) reset(pet.value)
        saved.value = false
        saveError.value = null
    }

    const save = async () => {
        if (!pet.value) return
        saving.value = true
        saved.value = false
        saveError.value = null
        try {
            const images: string[] = []
            for (const photo of photos.value) {
                images.push(photo.url ?? (await petsApi.uploadImage(await resizeImage(photo.file!, 1600))))
            }
            const body: AdminUpdatePetRequest = { ...form, name: form.name.trim() || null, images }
            pet.value = await api.updatePet(id, body)
            saved.value = true
        } catch (failure) {
            saveError.value = apiErrorCode(failure) === 'validation' ? 'admin_save_invalid' : 'error_try_later'
        } finally {
            saving.value = false
        }
    }

    const moderating = ref(false)
    const moderate = async (status: 'approved' | 'pending_review' | 'rejected') => {
        moderating.value = true
        saveError.value = null
        try {
            const updated = await api.moderatePet(id, status)
            if (updated) pet.value = updated
            else await navigateTo('/admin/mascotas')
        } catch {
            saveError.value = 'error_try_later'
        } finally {
            moderating.value = false
        }
    }

    const confirmDialog = ref<HTMLDialogElement | null>(null)
    const remove = async () => {
        moderating.value = true
        try {
            await api.deletePet(id)
            await navigateTo('/admin/mascotas')
        } catch {
            saveError.value = 'error_try_later'
            confirmDialog.value?.close()
        } finally {
            moderating.value = false
        }
    }

    const dateTime = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }))
    const today = new Date().toISOString().slice(0, 10)
</script>

<template>
    <div class="space-y-5">
        <NuxtLink to="/admin/mascotas" class="btn btn-ghost btn-sm -ml-3">
            <Icon name="mdi:arrow-left" /> {{ $t('admin_nav_pets') }}
        </NuxtLink>

        <EmptyState v-if="error || !pet" icon="mdi:paw-off-outline" :title="$t('pet_not_found')" />

        <div v-else class="grid gap-5 lg:grid-cols-[1fr_20rem]">
            <form class="surface space-y-6 p-5 sm:p-6" @submit.prevent="save">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <h1 class="text-2xl sm:text-3xl md:text-3xl">{{ pet.name || $t(`unnamed_${pet.species}`) }}</h1>
                    <div class="flex flex-wrap gap-2">
                        <PetStatusBadge :pet="pet" />
                        <AdminModerationBadge :status="pet.moderationStatus" />
                    </div>
                </div>

                <fieldset>
                    <legend class="mb-2 font-bold">{{ $t('photos') }}</legend>
                    <ul class="grid grid-cols-3 gap-3 sm:grid-cols-5">
                        <li v-for="(photo, index) in photos" :key="photo.preview" class="relative aspect-square">
                            <button
                                type="button"
                                class="block h-full w-full rounded-xl"
                                :class="
                                    index === 0 ? 'ring-2 ring-primary ring-offset-2' : 'opacity-90 hover:opacity-100'
                                "
                                :aria-label="index === 0 ? $t('main_photo') : $t('set_main_photo')"
                                :aria-pressed="index === 0"
                                @click="setMainPhoto(index)"
                            >
                                <img
                                    :src="photo.preview"
                                    alt=""
                                    class="h-full w-full rounded-xl bg-base-200 object-cover"
                                />
                            </button>
                            <span
                                v-if="photo.file"
                                class="pointer-events-none absolute bottom-1 left-1 rounded-full bg-neutral/70 px-2 text-xs text-neutral-content"
                            >
                                {{ $t('admin_new_photo') }}
                            </span>
                            <button
                                type="button"
                                class="btn btn-circle btn-xs absolute -right-2 -top-2 shadow"
                                :disabled="photos.length <= PET_LIMITS.minImages"
                                :aria-label="$t('remove_photo')"
                                @click="removePhoto(index)"
                            >
                                <Icon name="mdi:close" />
                            </button>
                        </li>
                        <li v-if="photos.length < PET_LIMITS.maxImages" class="aspect-square">
                            <label
                                class="flex h-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-base-300 bg-white text-center text-xs hover:border-primary/60"
                            >
                                <Icon name="mdi:camera-plus-outline" size="1.5rem" class="text-primary" />
                                {{ $t('add_photos') }}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    class="sr-only"
                                    @change="addPhotos(($event.target as HTMLInputElement).files)"
                                />
                            </label>
                        </li>
                    </ul>
                    <p class="mt-2 text-xs text-muted">{{ $t('admin_photos_hint') }}</p>
                </fieldset>

                <div class="grid gap-4 sm:grid-cols-2">
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('admin_report_type') }}</span>
                        <select v-model="form.reportType" class="select select-bordered bg-white">
                            <option value="lost">{{ $t('status_lost') }}</option>
                            <option value="found">{{ $t('status_found') }}</option>
                        </select>
                    </label>
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('species_label') }}</span>
                        <select v-model="form.species" class="select select-bordered bg-white">
                            <option value="dog">{{ $t('dog') }}</option>
                            <option value="cat">{{ $t('cat') }}</option>
                            <option value="other">{{ $t('other') }}</option>
                        </select>
                    </label>
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('admin_name') }}</span>
                        <input
                            v-model="form.name"
                            type="text"
                            :maxlength="PET_LIMITS.nameMaxLength"
                            class="input input-bordered bg-white"
                        />
                    </label>
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('admin_event_date') }}</span>
                        <input
                            v-model="form.eventDate"
                            type="date"
                            required
                            :max="today"
                            class="input input-bordered bg-white"
                        />
                    </label>
                    <label class="form-control sm:col-span-2">
                        <span class="label-text mb-1 font-bold">{{ $t('description') }}</span>
                        <textarea
                            v-model="form.description"
                            required
                            rows="5"
                            :maxlength="PET_LIMITS.descriptionMaxLength"
                            class="textarea textarea-bordered rounded-2xl bg-white text-base"
                        />
                    </label>
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('area_label') }}</span>
                        <input
                            v-model="form.location"
                            type="text"
                            required
                            :maxlength="PET_LIMITS.locationMaxLength"
                            class="input input-bordered bg-white"
                        />
                    </label>
                    <label class="form-control">
                        <span class="label-text mb-1 font-bold">{{ $t('admin_contact') }}</span>
                        <input
                            v-model="form.contact"
                            type="text"
                            required
                            :maxlength="PET_LIMITS.contactMaxLength"
                            class="input input-bordered bg-white"
                        />
                    </label>
                    <label v-if="form.reportType === 'found'" class="label cursor-pointer justify-start gap-3">
                        <input v-model="form.alive" type="checkbox" class="checkbox checkbox-primary" />
                        <span class="label-text">{{ $t('admin_alive') }}</span>
                    </label>
                    <label class="label cursor-pointer justify-start gap-3">
                        <input
                            type="checkbox"
                            class="checkbox checkbox-primary"
                            :checked="form.resolution === 'reunited'"
                            @change="
                                form.resolution = ($event.target as HTMLInputElement).checked ? 'reunited' : 'open'
                            "
                        />
                        <span class="label-text">{{ $t('admin_mark_reunited') }}</span>
                    </label>
                </div>

                <div v-if="saveError" class="alert alert-error" role="alert">{{ $t(saveError) }}</div>
                <div v-else-if="saved" class="alert alert-success text-white" role="status">
                    {{ $t('admin_saved') }}
                </div>

                <div class="flex flex-wrap gap-2">
                    <button type="submit" class="btn btn-primary" :disabled="saving">
                        <span v-if="saving" class="loading loading-spinner loading-sm" />
                        <Icon v-else name="mdi:content-save" />
                        {{ $t('admin_save') }}
                    </button>
                    <button type="button" class="btn btn-ghost" :disabled="saving" @click="discard">
                        {{ $t('admin_discard') }}
                    </button>
                </div>
            </form>

            <aside class="space-y-4">
                <section class="surface space-y-3 p-5">
                    <h2 class="text-lg sm:text-lg">{{ $t('admin_publication') }}</h2>
                    <button
                        v-if="pet.moderationStatus === 'pending_review'"
                        type="button"
                        class="btn btn-success w-full text-white"
                        :disabled="moderating"
                        @click="moderate('approved')"
                    >
                        <Icon name="mdi:check" /> {{ $t('admin_publish') }}
                    </button>
                    <template v-else>
                        <NuxtLink :to="`/mascota/${pet.id}`" target="_blank" class="btn btn-outline w-full">
                            <Icon name="mdi:open-in-new" /> {{ $t('admin_view_public') }}
                        </NuxtLink>
                        <button
                            type="button"
                            class="btn btn-ghost w-full"
                            :disabled="moderating"
                            @click="moderate('pending_review')"
                        >
                            <Icon name="mdi:eye-off-outline" /> {{ $t('admin_hide') }}
                        </button>
                    </template>
                    <button
                        type="button"
                        class="btn btn-outline btn-error w-full"
                        :disabled="moderating"
                        @click="confirmDialog?.showModal()"
                    >
                        <Icon name="mdi:delete-outline" /> {{ $t('admin_delete') }}
                    </button>
                </section>

                <section class="surface space-y-3 p-5">
                    <h2 class="text-lg sm:text-lg">{{ $t('admin_moderator_scores') }}</h2>
                    <AdminModerationScores :scores="pet.moderationScores" />
                </section>

                <section class="surface p-5 text-sm">
                    <dl class="space-y-2">
                        <div>
                            <dt class="text-muted">{{ $t('admin_created_at') }}</dt>
                            <dd>{{ dateTime.format(new Date(pet.createdAt)) }}</dd>
                        </div>
                        <div v-if="pet.moderatedAt">
                            <dt class="text-muted">{{ $t('admin_moderated_at') }}</dt>
                            <dd>{{ dateTime.format(new Date(pet.moderatedAt)) }}</dd>
                        </div>
                        <div v-if="pet.resolvedAt">
                            <dt class="text-muted">{{ $t('admin_resolved_at') }}</dt>
                            <dd>{{ dateTime.format(new Date(pet.resolvedAt)) }}</dd>
                        </div>
                        <div>
                            <dt class="text-muted">ID</dt>
                            <dd class="break-all font-mono text-xs">{{ pet.id }}</dd>
                        </div>
                    </dl>
                </section>
            </aside>
        </div>

        <dialog ref="confirmDialog" class="modal">
            <div class="modal-box">
                <h2 class="text-lg sm:text-lg">{{ $t('admin_delete_title') }}</h2>
                <p class="py-3 text-sm">{{ $t('admin_delete_body') }}</p>
                <div class="modal-action">
                    <button type="button" class="btn btn-ghost" @click="confirmDialog?.close()">
                        {{ $t('admin_cancel') }}
                    </button>
                    <button type="button" class="btn btn-error" :disabled="moderating" @click="remove">
                        {{ $t('admin_delete') }}
                    </button>
                </div>
            </div>
            <form method="dialog" class="modal-backdrop">
                <button>{{ $t('close') }}</button>
            </form>
        </dialog>
    </div>
</template>
