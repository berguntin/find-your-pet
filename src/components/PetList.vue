<template>
  <div class="container mx-auto p-4">
    <h1 class="text-4xl font-bold mb-8 text-center">Mascotas Perdidas y Encontradas en Valencia</h1>
    
    <div class="mb-8 flex justify-center">
      <div class="join">
        <button 
          @click="filterStatus = 'all'" 
          :class="['btn join-item', filterStatus === 'all' ? 'btn-active' : '']"
        >
          Todas
        </button>
        <button 
          @click="filterStatus = 'lost'" 
          :class="['btn join-item', filterStatus === 'lost' ? 'btn-active' : '']"
        >
          Perdidas
        </button>
        <button 
          @click="filterStatus = 'found'" 
          :class="['btn join-item', filterStatus === 'found' ? 'btn-active' : '']"
        >
          Encontradas
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
      <p class="text-xl mt-4">Cargando...</p>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>{{ error }}</span>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <PetCard 
        v-for="pet in filteredPets" 
        :key="pet.id" 
        :pet="pet"
        @updateList="loadPets"
      />
    </div>

    <div v-if="filteredPets.length === 0 && !loading" class="alert alert-info mt-8">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>No se encontraron mascotas que coincidan con el filtro seleccionado.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { getList } from '../api/index'
import PetCard from '../components/PetCard.vue'

const pets = ref([])
const loading = ref(true)
const error = ref(null)
const filterStatus = ref('all')



const loadPets = async () => {
  try {
    pets.value = await getList()
    loading.value = false
  } catch (e) {
    error.value = 'Error al cargar los datos de las mascotas. Por favor, inténtelo de nuevo más tarde.'
    loading.value = false
  }
}
const filteredPets = computed(() => {
  if (filterStatus.value === 'all') {
    return pets.value
  }
  return pets.value.filter(pet => pet.status === filterStatus.value)
})

onMounted(loadPets)
</script>