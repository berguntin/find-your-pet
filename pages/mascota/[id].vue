<script setup lang="ts">
import ButtonShare from '@/components/ButtonShare.vue'
// import function to register Swiper custom elements
import { register } from 'swiper/element/bundle';
// register Swiper custom elements
register();

const route = useRoute();
const runtimeConfig = useRuntimeConfig();

const {
  data: pet,
  status,
  error,
} = await useFetch<Pet>(
  `${runtimeConfig.public.apiBase}/pets/${route.params.id}`
);

// esto lo tuve que hace asi porque me devuelve mal la propiedad images, me devuelve un string deberia ser un array
const getImages = computed(() => {
  return JSON.parse(pet.value?.images as string);
});
</script>

<template>
  <AppError v-if="error" class="mx-auto" />
  <AppLoading v-if="status === 'pending'" class="text-center py-8" />

  <div v-if="pet" class="container mx-auto mt-5 mb-5" >
      <div class="flex flex-col md:flex-row md:space-x-6">
        <!-- Photo Slider -->
        <div class="md:w-1/2 mb-6 md:mb-0 h-full bg-transparent">
          <div class="relative rounded-lg overflow-hidden">
            <swiper-container pagination="true" scrollbar="true">
              <swiper-slide  v-for="(photo, index) in getImages" >
                <img :src="photo" :alt="`imagen de ${pet.name || 'la mascota'}`" class="m-auto">
              </swiper-slide>
            </swiper-container>
          </div>
        </div>
        <!-- Pet Information Card -->
        <div class="md:w-1/2 h-full" >
          <div class="bg-base-content shadow-lg rounded-lg overflow-hidden">
            <div class="p-4">
              <div class="flex justify-between items-center my-4" v-if="pet.name">
                <h1 class="text-3xl font-bold text-gray-800">{{ pet.name }}</h1>
              </div>
              <div class="flex flex-row justify-between my-1">
                <div class="flex items-center">
                <MapPinIcon class="w-4 h-4 mr-1" />
                    <span class="text-gray-600">{{ pet.location }}</span>
                </div>
                <div class="flex items-center">
                    <CalendarIcon class="w-4 h-4 mr-1"/>
                    <span class="text-gray-600"> {{ formatDate(pet.date) }}</span>
                </div>
              
              </div>
              
              <div class="flex justify-start gap-3 align-middle mb-4" v-if="pet.status === 'found'">
                
                <span v-if="pet.athome" class="badge badge-accent badge-lg p-4">Reunido con su familia!!</span>
                <span v-else 
                  :class="[
                    'px-3 py-1 badge font-semibold',
                    pet.status === 'lost' ? 'badge-error' : 'badge-warning text-gray-900'
                  ]"
                >
                  {{ pet.status === 'lost' ? 'Me buscan' : 'Encontrado' }}
                </span>
                <span 
                  :class="[
                    'px-3 py-1 badge font-semibold mr-2',
                    pet.alive ? 'badge-success' : 'bg-red-100 text-red-800'
                  ]"
                >
                  {{ pet.alive ? 'Vivo' : 'Fallecido' }}
                </span>
              </div>
              <p class="text-gray-700 my-4">{{ pet.description }}</p>
              <div class="mb-4">
                <h2 class="text-md font-semibold text-gray-800 mb-2">Contacto:</h2>
                <p class="text-gray-600">{{ pet.contact }}</p>
              </div>
              <div class="flex justify-between align-middle mt-4 gap-1">
                <div v-if="pet.alive && !pet.athome">
                  <button :class="['btn w-100 m-auto text-gray-50', error ? 'btn-warning' :  'btn-primary']" 
                          @click="confirmSetAtHome" :disabled="isLoading">
                      {{error ? error : 'Marcar como "en casa"'}}
                  </button>
                </div>
                <ButtonShare :pet="pet" :onlyIcon="false"/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
</template>
