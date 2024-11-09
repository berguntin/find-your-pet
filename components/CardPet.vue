<script setup lang="ts">
const props = defineProps<{
  modelValue?: boolean;
}>();
</script>

<template>
  <div class="card bg-base-100 shadow-xl">
    <figure>
      <div
        class="absolute top-2 right-2 badge badge-lg text-base-100 badge-accent"
      >
        Me buscan
      </div>
      <img
        loading="lazy"
        class="w-full h-80 object-cover"
        src="https://res.cloudinary.com/dj2xpupyt/image/upload/v1730786411/pets/muz9hlsfbxuwpa5advec.jpg"
        alt="undefined - Image 1"
      />
    </figure>
    <div class="card-body">
      <div class="card-title">
        <div class="flex w-full justify-between">
          <div class="flex items-center gap-2">
            <Icon name="bxs:map" />
            <p>Manises</p>
          </div>
          <div class="flex items-center gap-2">
            <Icon name="mdi-light:calendar" />
            <p>29/10/2024</p>
          </div>
        </div>
      </div>
      <p class="flex items-center gap-3">
        <Icon name="fluent-mdl2:contact" />
        <span>603854595</span>
      </p>
      <p>
        Hola,se llama thor y está perdido desde el martes en cheste,zona de la
        garrama.
      </p>

      <div class="card-actions justify-end">
        <a href="" class="btn btn-link text-base no-underline">
          Ver detalles
          <Icon name="mdi:arrow-up-thin" class="rotate-90" size="1.5rem" />
        </a>
      </div>
    </div>
  </div>
</template>
