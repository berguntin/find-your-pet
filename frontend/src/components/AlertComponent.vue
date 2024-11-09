<template>
    <div class="w-100 flex flex-col gap-5 justify-center bg-base-200">
        <div role="alert" :class="`alert alert-${alertType}`">
        
            <BadgeCheckIcon v-if="alertType === 'success'"/>
            <CircleX v-else-if="alertType === 'error'"/>
            <TriangleAlertIcon v-else/>
            
            <span>{{ message }}</span>

        </div>
        <RouterLink to="/" class="btn btn-secondary">Volver al listado</RouterLink>
    </div>
    
    
</template>
<script setup>
import { defineProps } from 'vue';
import { TriangleAlertIcon, CircleX, BadgeCheckIcon  } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';

const props = defineProps({
    alertType: {
        type: String,
        required: true,
        validator: (value) => {
            return ['warning', 'success', 'error'].includes(value)
        }
    },
    message: String
})

</script>