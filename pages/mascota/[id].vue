<script setup lang="ts">
const route = useRoute();

const {
  data: pet,
  status,
  error,
} = await useLazyFetch<Pet>(`/api/pets/${route.params.id}`);

// esto lo tuve que hace asi porque me devuelve mal la propiedad images, me devuelve un string deberia ser un array
const getImage = computed(() => {
  return JSON.parse(pet.value?.images as string);
});
</script>

<template>
  <div>
    <AppError v-if="error" class="mx-auto" />
    <ClientOnly>
      <AppLoading v-if="status === 'pending'" class="text-center py-8" />
    </ClientOnly>

    <div v-if="pet">
      <div class="flex flex-col lg:flex-row gap-8 justify-center py-8">
        <div>
          <figure>
            <img :src="getImage[0]" :alt="pet.name" />
          </figure>
        </div>
        <div>
          <h2 class="font-bold text-3xl">{{ pet.name }}</h2>

          <div class="flex w-full justify-between">
            <div class="flex items-center gap-2">
              <Icon name="bxs:map" />
              <p>{{ pet.location }}</p>
            </div>
            <div class="flex items-center gap-2">
              <Icon name="mdi-light:calendar" />
              <p>{{ formatDate(pet.date) }}</p>
            </div>
          </div>
          <p class="py-5">{{ pet.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
