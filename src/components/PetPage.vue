<template>
    <div class="container mx-auto p-4 mt-5 mb-5" v-if="pet">
      <div class="flex flex-col md:flex-row md:space-x-6">
        <!-- Photo Slider -->
        <div class="md:w-1/2 mb-6 md:mb-0 h-full">
          <div class="relative h-64 md:h-96 bg-gray-200 rounded-lg overflow-hidden">
            <img 
              v-for="(photo, index) in pet.images" 
              :key="index" 
              :src="photo" 
              :alt="`Photo of ${pet.name || 'pet'}`"
              class="absolute inset-0 w-full h-full object-contain transition-opacity duration-500 ease-in-out"
              :class="{ 'opacity-100': currentPhotoIndex === index, 'opacity-0': currentPhotoIndex !== index }"
            >
            <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              <button 
                v-for="(_, index) in pet.photos" 
                :key="index"
                @click="currentPhotoIndex = index"
                class="w-3 h-3 rounded-full bg-white opacity-50 hover:opacity-100 transition-opacity duration-300"
                :class="{ 'opacity-100': currentPhotoIndex === index }"
              ></button>
            </div>
          </div>
        </div>
  
        <!-- Pet Information Card -->
        <div class="md:w-1/2 h-full" >
          <div class="bg-white shadow-lg rounded-lg overflow-hidden">
            <div class="p-6">
              <div class="flex justify-between items-center my-4">
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
                  {{ pet.status === 'lost' ? 'Perdido' : 'Encontrado' }}
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
                <h2 class="text-lg font-semibold text-gray-800 mb-2">Contacto:</h2>
                <p class="text-gray-600">{{ pet.contact }}</p>
              </div>
              <div v-if="pet.alive && !pet.athome" class="mt-4">
                <button :class="['btn w-100 m-auto text-gray-50', error ? 'btn-warning' :  'btn-primary']" 
                        @click="confirmSetAtHome" :disabled="isLoading">
                    {{error ? error : 'Marcar como "en casa"'}}
                </button>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>
  
<script setup>
    import { onMounted, ref } from 'vue'
    import { CalendarIcon, MapPinIcon } from 'lucide-vue-next'
    import { useRoute } from 'vue-router';
    import { formatDate } from '@/helpers/dateHelper'
    import { getPetById } from '../api';
    import { setAtHome } from '../api';

    const petId = useRoute().params.id
    
    const error = ref(false);
    const isLoading = ref(false)
    const pet = ref(null)
    const currentPhotoIndex = ref(0)
    
    const confirmSetAtHome = () => {
        if (confirm('¿Estás seguro de que quieres marcar esta mascota como devuelta a casa?')) {
        
            pet.value.athome = true
        
            markAtHome(pet.value.id)

        }
    }

    const markAtHome = async (petId) => {
        try {
            isLoading.value = true
            const response = await setAtHome(petId);
            console.log(response)
            if (response && response.ok) { 
             pet.value.athome = true
            } else {
            error.value = 'Ha ocurrido un error';
            }
        } catch (err) {
            error.value = 'Ha ocurrido un error';
            console.error(err);
        }
        isLoading.value = false
    };

    onMounted( async () => {
        pet.value = await getPetById(petId)
        pet.value = {
            ...pet.value,
            images: JSON.parse(pet.value.images)
        }
    })
</script>