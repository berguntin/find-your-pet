<script setup lang="ts">
const props = defineProps<{
  modelValue?: boolean;
}>();
</script>

<template>
  <div
    class="mx-auto grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 my-5 p-5 bg-base-300"
  >
    <CardPet v-for="i in 10" :key="i" />
  </div>
</template>
