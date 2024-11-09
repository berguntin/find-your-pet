<script setup lang="ts">
import type { Filters } from "~/types/Filters";

const runtimeConfig = useRuntimeConfig();
const actualFilters = ref<Filters>({
  status: "all",
  location: "",
});

const {
  data: pets,
  status,
  error,
} = await useFetch<Pet[]>(`${runtimeConfig.public.apiBase}/pets`);

const getPets = computed(() => {
  if (!pets.value) return [];
  if (actualFilters.value.status === "all") return pets.value;
  return (
    pets.value?.filter((pet) => pet.status === actualFilters.value.status) ?? []
  );
});

const setFilter = (filters: Filters) => {
  actualFilters.value = filters;
};
</script>

<template>
  <AppHero />
  <AppFilters @@set-filter="setFilter" />
  <AppError v-if="error" class="mx-auto" />
  <AppLoading v-if="status === 'pending'" class="text-center py-8" />
  <ListPets v-if="pets" :pets="getPets" />
</template>
