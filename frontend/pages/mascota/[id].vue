<script setup lang="ts">
    import ButtonShare from '@/components/social/ButtonShare.vue'

    const route = useRoute()

    const { data, status, error } = await useFetch<Pet>(`/api/pets/${route.params.id}`)

    const pet = ref(<Pet>{ ...data.value, images: JSON.parse(data.value?.images as string) })

const metaData = useMetadata(pet.value)
const config = useRuntimeConfig()
const openGraph = useOpenGraph(pet.value)

useHead(openGraph);
</script>

<template>
    <AppError v-if="error" class="mx-auto" />
    <ClientOnly>
        <AppLoading v-if="status === 'pending'" class="text-center py-8" />
    </ClientOnly>

    <div v-if="pet" class="container mx-auto mt-5 mb-5">
        <div class="flex flex-col md:flex-row md:space-x-6">
            <!-- Photo Slider -->
            <div class="md:w-1/2 mb-6 md:mb-0 h-full">
                <div class="relative rounded-lg overflow-hidden">
                    <Swiper>
                        <SwiperSlide v-for="(photo, index) in pet.images" :key="photo">
                            <img :src="photo" :alt="`imagen de ${pet.name || 'la mascota'}`" class="m-auto" />
                        </SwiperSlide>
                    </Swiper>
                </div>
            </div>
            <!-- Pet Information Card -->
            <div class="md:w-1/2 h-full">
                <div class="bg-base-100 shadow-lg rounded-lg overflow-hidden">
                    <div class="p-4">
                        <div class="flex justify-between items-center my-4" v-if="pet.name">
                            <h1 class="text-3xl font-bold text-base-content">
                                {{ pet.name }}
                            </h1>
                        </div>
                        <div class="flex flex-row justify-between my-1">
                            <div class="flex items-center">
                                <Icon name="bxs:map" />
                                <span class="text-base-content/70">{{ pet.location }}</span>
                            </div>
                            <div class="flex items-center">
                                <Icon name="mdi-light:calendar" />
                                <span class="text-base-content/70">{{ formatDate(pet.date) }}</span>
                            </div>
                        </div>

                        <div class="flex justify-start gap-3 align-middle mb-4">
                            <span v-if="pet.athome" class="badge badge-accent badge-lg p-4"
                                >Reunido con su familia!! {{ pet.status }}</span
                            >
                            <span
                                v-else
                                :class="[
                                    'px-3 py-1 badge font-semibold',
                                    pet.status === 'lost' ? 'badge-error' : 'badge-warning'
                                ]"
                            >
                                {{ pet.status === 'lost' ? 'Me buscan' : 'Encontrado' }}
                            </span>
                            <span v-if="pet.status === 'found'"
                                :class="[
                                    'px-3 py-1 badge font-semibold mr-2',
                                    pet.alive ? 'badge-success' : 'badge-error'
                                ]"
                            >
                                {{ pet.alive ? 'Vivo' : 'Fallecido' }}
                            </span>
                        </div>
                        <p class="text-base-content/80 my-4">{{ pet.description }}</p>
                        <div class="mb-4">
                            <h2 class="text-md font-semibold text-base-content mb-2">Contacto:</h2>
                            <p class="text-base-content/70">{{ pet.contact }}</p>
                        </div>
                        <div class="flex justify-between align-middle mt-4 gap-1">
                            <div v-if="pet.alive && !pet.athome">
                                <button :class="['btn w-100 m-auto', error ? 'btn-warning' : 'btn-primary']" @click="">
                                    {{ error ? error : 'Marcar como "en casa"' }}
                                </button>
                            </div>
                            <ButtonShare :pet="pet" :onlyIcon="false" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
