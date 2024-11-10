<script setup lang="ts">
import type { Filters } from "~/types/Filters";

const actualFilters = ref<Filters>({
  status: "all",
  location: "",
});

const search = ref<String>('')

const { data: pets, status, error } = await useLazyFetch<Pet[]>("/api/pets");

const getPets = computed(() => {
  if (!pets.value) return [];

  return pets.value.filter((pet) => {
   
   const matchesSearch = search.value
     ? Object.values(pet).some((value) => {
         if (typeof value !== 'string') return false;
         return value.toLowerCase().includes(search.value.toLowerCase());
       })
     : true;


   const matchesStatus = actualFilters.value.status !== 'all'
     ? pet.status === actualFilters.value.status
     : true;

   
   return matchesSearch && matchesStatus;
 });
});


const setFilter = (filters: Filters) => {
  actualFilters.value = filters;
};

const handleSearch = (query: String) => {
  search.value = query
}
</script>

<template>
  <AppHero @search="handleSearch"/>
  <AppFilters @@set-filter="setFilter" />
  <AppError v-if="error" class="mx-auto" />
  <ClientOnly>
    <AppLoading v-if="status === 'pending'" class="text-center py-8" />
  </ClientOnly>
  <ListPets :pets="getPets" />
</template>
