<template>
    <div class="container mx-auto p-4">
      <h1 class="text-3xl font-bold mb-6 text-center">Mascotas Perdidas y Encontradas en Valencia</h1>
      
      <div class="mb-6 flex justify-center gap-2">
        <button 
          @click="filterStatus = 'all'" 
          :class="['px-4 py-2 rounded-l-lg', filterStatus === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200']"
        >
          Todas
        </button>
        <button 
          @click="filterStatus = 'lost'" 
          :class="['px-4 py-2', filterStatus === 'lost' ? 'bg-blue-500 text-white' : 'bg-gray-200']"
        >
          Perdidas
        </button>
        <button 
          @click="filterStatus = 'found'" 
          :class="['px-4 py-2 rounded-r-lg', filterStatus === 'found' ? 'bg-blue-500 text-white' : 'bg-gray-200']"
        >
          Encontradas
        </button>
      </div>
  
      <div v-if="loading" class="text-center text-xl">
        <Loader2Icon class="animate-spin inline-block mr-2" />
        Cargando...
      </div>
  
      <div v-else-if="error" class="text-center text-xl text-red-500">
        {{ error }}
      </div>
  
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PetCard 
          v-for="pet in filteredPets" 
          :key="pet.id" 
          :pet="pet"
        />
      </div>
  
      <div v-if="filteredPets.length === 0 && !loading" class="text-center text-xl mt-6">
        No se encontraron mascotas que coincidan con el filtro seleccionado.
      </div>
    </div>
  </template>
  
  <script setup>
  import { ref, onMounted, computed } from 'vue'
  import { getList } from '../api/mockdata.js'
  import PetCard from '../components/PetCard.vue'
  import { Loader2Icon } from 'lucide-vue-next'
  
  const pets = ref([])
  const loading = ref(true)
  const error = ref(null)
  const filterStatus = ref('all')
  
  onMounted(async () => {
    try {
      pets.value = await getList()
      loading.value = false
    } catch (e) {
      error.value = 'Error al cargar los datos de las mascotas. Por favor, inténtelo de nuevo más tarde.'
      loading.value = false
    }
  })
  
  const filteredPets = computed(() => {
    if (filterStatus.value === 'all') {
      return pets.value
    }
    return pets.value.filter(pet => pet.status === filterStatus.value)
  })
  </script>