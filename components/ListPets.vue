<script setup lang="ts">
const props = defineProps<{
  pets: Pet[];
}>();
</script>

<template>
  <div
    class="mx-auto grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 my-5 p-5 bg-base-300"
  >
    <CardPet v-for="pet in pets" :key="pet.id" :pet="pet" />
  </div>
</template>
