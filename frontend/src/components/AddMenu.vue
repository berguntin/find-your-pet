<template>
    <div class="flex flex-row justify-end w-full sticky top-0 z-50 bg-base-100 p-1 shadow-sm">
        <RouterLink :to="{name: 'RegisterForm'}" class="flex rounded mt-1 mr-5 btn btn-outline btn-primary">
            <CirclePlus /> Añadir mascota
        </RouterLink>
    </div>
</template>


<script setup>
 import { CirclePlus } from 'lucide-vue-next'
</script>

