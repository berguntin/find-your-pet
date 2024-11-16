<template>
    <div class="w-full flex flex-col gap-5 justify-center bg-base-200 p-4">
        <div role="alert" :class="`alert ${alertTypeClass}`">
            <Icon v-if="alertType === 'success'" name="heroicons:check-badge-20-solid" class="w-6 h-6" />
            <Icon v-else-if="alertType === 'error'" name="heroicons:x-circle-20-solid" class="w-6 h-6" />
            <Icon v-else name="heroicons:exclamation-triangle-20-solid" class="w-6 h-6" />
            <span>{{ message }}</span>
        </div>
        <NuxtLink to="/" class="btn btn-secondary">Volver al listado</NuxtLink>
    </div>
</template>

<script setup lang="ts">
    type AlertType = 'warning' | 'success' | 'error'

    interface Props {
        alertType: AlertType
        message: string
    }

    const props = withDefaults(defineProps<Props>(), {
        message: ''
    })

    const alertTypeClass = computed(() => {
        switch (props.alertType) {
            case 'success':
                return 'alert-success'
            case 'error':
                return 'alert-error'
            default:
                return 'alert-warning'
        }
    })
</script>

<style scoped>
    /* Add any scoped styles here if needed */
</style>
