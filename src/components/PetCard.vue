<template>
  <div class="card bg-base-100 shadow-xl">
    <figure class="relative">
      <img :class="['w-full h-80 object-cover', !pet.alive ? 'blur-md hover:blur-0 transition duration-300 ease-in-out' : '']" :src="pet.images[0]" :alt="pet.breed">
      <div v-if="pet.atHome" 
           class="absolute top-2 left-2 badge badge-primary badge-lg gap-2">
        <HomeIcon class="w-4 h-4" />
        EN CASA
      </div>
      <div class="absolute top-2 right-2 badge badge-lg text-gray-100"
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
          <UserIcon class="w-4 h-4 mr-1" />
          <a :href="`tel:${pet.contact}`" class="link link-hover">{{pet.contact}}</a>
        </div>
        <div v-if="!pet.alive" class="badge badge-neutral">Fallecido</div>
      </div>
      <p class="text-sm mt-2">{{ pet.description }}</p>
      <div v-if="pet.alive && !pet.atHome" class="card-actions justify-end mt-4">
        <button :class="['btn btn-sm text-gray-50', error ? 'btn-warning' :  'btn-primary']" @click="markAtHome(pet.id)">
          {{error ? error : 'Marcar como "en casa"'}}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { MapPinIcon, CalendarIcon, PhoneIcon, HomeIcon, UserIcon } from 'lucide-vue-next'
import { formatDate } from '../helpers/dateHelper'
import { setAtHome } from '../api';
import { ref } from 'vue';
import { defineEmits } from 'vue';


const props = defineProps({
  pet: {
    type: Object,
    required: true,
    validator: (pet) => {
      return ['id','status', 'photoUrl', 'breed', 'location', 'date', 'description', 'contact'].every(key => key in pet)
    }
  }
})

const emit = defineEmits(['updateList']);

const error = ref(false);

const markAtHome = async (petId) => {
  try {
    const response = await setAtHome(petId);

    if (response && response.success) { 
      emit('updateList'); 
    } else {
      error.value = 'Ha ocurrido un error';
    }
  } catch (err) {
    error.value = 'Ha ocurrido un error';
    console.error(err);
  }
};

</script>