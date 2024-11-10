<script setup lang="ts">
const props = defineProps<{
  pet: Pet;
}>();
</script>

<template>
  <div>
    <div class="card bg-base-100 shadow-xl h-full">
      <NuxtLink :to="{ name: 'mascota-id', params: { id: pet.id } }">
        <figure>
          <div
            class="absolute top-2 right-2 badge badge-lg text-base-100 badge-accent"
            :class="{
              'badge-accent': pet.status === 'lost',
              'badge-info': pet.status === 'found',
            }"
          >
            {{ pet.status === "lost" ? "Perdido" : "Se busca dueño" }}
          </div>

          <img
            loading="lazy"
            class="w-full h-80 object-cover"
            :src="pet.images[0]"
            :alt="pet.name"
          />
        </figure>
      </NuxtLink>
      <div class="card-body">
        <div class="card-title">
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
        </div>
        <p class="flex items-center gap-3">
          <Icon name="fluent-mdl2:contact" />
          <span>{{ pet.contact }}</span>
        </p>
        <p>
          {{ pet.description.replace(/\n/g, " ").replace(/\s+/g, " ").trim() }}
        </p>

        <div class="card-actions justify-end">
          <NuxtLink
            class="btn btn-link text-base no-underline"
            :to="{ name: 'mascota-id', params: { id: pet.id } }"
          >
            Ver detalles
            <Icon name="mdi:arrow-up-thin" class="rotate-90" size="1.5rem" />
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
