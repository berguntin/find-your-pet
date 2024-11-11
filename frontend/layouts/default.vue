<script setup lang="ts">
const props = defineProps<{
  modelValue?: boolean;
}>();
</script>

<template>
  <TheHeader />
  <main class="container mx-auto bg-base-100">
    <slot />
  </main>
  <footer></footer>
</template>
