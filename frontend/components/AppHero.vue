<script setup lang="ts">
const emit = defineEmits<{
  (e: "search", data: String): void;
}>();

const emitSearch = (search: string) => {
  emit("search", search);
};
</script>

<template>
  <div class="text-center p-5 bg-base-300">
    <h1>Mascotas perdidas - Valencia</h1>
    <p
      class="max-w-md mx-auto mt-3 text-base-content sm:text-lg md:mt-5 md:text-xl md:max-w-2xl"
    >
      A causa de las inundaciones provocadas en Valencia por la DANA, muchas
      mascotas están perdidas, lejos de su familia. <br />
      Necesitamos <strong>tu ayuda</strong>
      para que puedan regresar a sus hogares.
    </p>

    <AppSearch @update-query="emitSearch" />
  </div>
</template>
