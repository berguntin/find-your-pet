<script setup lang="ts">
import type { Filters } from "~/types/Filters";

const actualFilters = ref<Filters>({
  status: "all",
  location: "",
});

const { data: pets, status, error } = await useLazyFetch<Pet[]>("/api/pets");

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
  <ClientOnly>
    <AppLoading v-if="status === 'pending'" class="text-center py-8" />
  </ClientOnly>
  <ListPets :pets="getPets" />
</template>
