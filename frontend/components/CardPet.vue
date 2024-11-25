<script setup lang="ts">
    import ButtonShare from '@/components/social/ButtonShare.vue'

    const props = defineProps<{
        pet: Pet
    }>()
</script>

<template>
    <div class="card bg-base-100 shadow-xl overflow-hidden border-slate-200/80 border">
        <figure class="relative h-[300px]">
            <Swiper class="w-full h-[300px]" :loop="true">
                <SwiperSlide v-for="(image, index) in pet.images" :key="pet.id">
                    <img
                        loading="lazy"
                        :class="['w-full h-80 object-cover', !pet.alive ? 'blur-md' : '']"
                        :src="image"
                        :alt="`${pet.name} - Image ${index + 1}`"
                    />
                </SwiperSlide>
            </Swiper>

            <div v-if="!pet.alive" class="absolute z-10 inset-0 flex justify-center items-center flex-col text-gray-50">
                <Icon name="el:eye-close" />
                <span>Contenido sensible</span>
            </div>
            <div v-if="pet.athome" class="absolute top-2 left-2 badge badge-primary badge-lg gap-2 p-4 z-10">
                <Icon name="material-symbols:home-outline" />
                Reunido con su familia!!
            </div>
            <div
                v-if="!pet.athome"
                class="absolute top-2 right-2 badge badge-lg text-gray-100 z-10"
                :class="pet.status === 'lost' ? 'badge-error' : 'badge-warning text-white'"
            >
                {{ pet.status === 'lost' ? 'Me buscan' : 'Encontrado' }}
            </div>
        </figure>
        <div class="card-body p-4">
            <div class="flex justify-between text-sm">
                <div class="flex items-center gap-x-1">
                    <Icon name="bxs:map" />
                    <span>{{ pet.location }}</span>
                </div>
                <div class="flex items-center gap-x-1">
                    <Icon name="mdi-light:calendar" />
                    <span>{{ formatDate(pet.date) }}</span>
                </div>
            </div>
            <div class="flex items-center justify-between mt-2 ">
                <div class="flex items-center overflow-hidden gap-2">
                    <Icon name="fluent-mdl2:contact" />
                    <span class="truncate"> {{ pet.contact }} </span>
                </div>
                <div v-if="!pet.alive" class="badge badge-neutral">Fallecido</div>
            </div>
            <p class="text-sm mt-2 line-clamp-2 mb-2 text-gray-400">
                {{ pet.description.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim() }}
            </p>
        </div>
        <div class="card-actions p-2 flex justify-between">
            <ButtonShare :pet="pet" :onlyIcon="true" className="btn-ghost hover:bg-slate-200/70" />
            <NuxtLink :to="{ name: 'mascota-id', params: { id: pet.id } }" class="w-100 btn btn-ghost hover:bg-slate-200/70">
                Ver detalles
                <Icon name="mdi:arrow-up-thin" class="rotate-90" size="1.5rem" />
            </NuxtLink>
        </div>
    </div>
</template>
