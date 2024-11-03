<template>
  <div class="max-w-sm rounded overflow-hidden shadow-lg bg-white">
    <div class="relative">
      <img class="w-full h-48 object-cover" :src="pet.photoUrl" :alt="pet.breed">
      <span 
        class="absolute top-2 right-2 px-2 py-1 text-sm font-bold rounded"
        :class="pet.status === 'lost' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'"
      >
        {{ pet.status === 'lost' ? 'Perdido' : 'Encontrado' }}
      </span>
    </div>
    <div class="px-6 py-4">
      <div class="flex w-full justify-between">
        <p class="text-gray-700 text-base mb-2">
        <MapPinIcon class="inline-block w-4 h-4 mr-1" />
        {{ pet.location }}
      </p>
      <p class="text-gray-700 text-base mb-2">
        <CalendarIcon class="inline-block w-4 h-4 mr-1" />
        {{ formatDate(pet.date) }}
      </p>
      </div>

      <div class="font-bold text-gray-700 mb-2 text-start">Raza: {{ pet.breed }}</div>
      
      <p class="text-gray-700 text-base mb-4">{{ pet.description }}</p>
      <div class="flex items-center justify-between">
        <p class="text-gray-700 text-sm">
          <PhoneIcon class="inline-block w-4 h-4 mr-1" />
          <a :href="`tel:${pet.contact}`">{{pet.contact}}</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { MapPinIcon, CalendarIcon, PhoneIcon } from 'lucide-vue-next'
import { formatDate } from '../helpers/dateHelper'

const props = defineProps({
  pet: {
    type: Object,
    required: true,
    validator: (pet) => {
      return ['status', 'photoUrl', 'breed', 'location', 'date', 'description', 'contact'].every(key => key in pet)
    }
  }
})
</script>