<template>
  <div class="card bg-base-100 shadow-xl">
    <figure class="relative">
      <img class="w-full h-80 object-cover" :src="pet.images[0]" :alt="pet.breed">
      <div v-if="pet.atHome" 
           class="absolute top-2 left-2 badge badge-primary badge-lg gap-2">
        <HomeIcon class="w-4 h-4" />
        EN CASA
      </div>
      <div class="absolute top-2 right-2 badge badge-lg"
           :class="pet.status === 'lost' ? 'badge-error' : 'badge-success'">
        {{ pet.status === 'lost' ? 'Perdido' : 'Encontrado' }}
      </div>
    </figure>
    <div class="card-body p-4">
      <div class="flex justify-between text-sm">
        <div class="flex items-center">
          <MapPinIcon class="w-4 h-4 mr-1" />
          <span>{{ pet.location }}</span>
        </div>
        <div class="flex items-center">
          <CalendarIcon class="w-4 h-4 mr-1" />
          <span>{{ formatDate(pet.date) }}</span>
        </div>
      </div>
      <div class="flex items-center justify-between mt-2">
        <div class="flex items-center">
          <PhoneIcon class="w-4 h-4 mr-1" />
          <a :href="`tel:${pet.contact}`" class="link link-hover">{{pet.contact}}</a>
        </div>
        <div v-if="!pet.alive" class="badge badge-neutral">Fallecido</div>
      </div>
      <p class="text-sm mt-2">{{ pet.description }}</p>
      <div v-if="pet.alive && !pet.atHome" class="card-actions justify-end mt-4">
        <button class="btn btn-primary btn-sm">
          Marcar como "en casa"
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { MapPinIcon, CalendarIcon, PhoneIcon, HomeIcon } from 'lucide-vue-next'
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