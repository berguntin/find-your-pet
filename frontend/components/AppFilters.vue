<script setup lang="ts">
    const emit = defineEmits<{
        (e: '@setFilter', data: Filters): void
    }>()

    const actualStatus = ref<status>('all')
    const actualLocation = ref('')

    const handleStatus = (status: status) => {
        actualStatus.value = status
        emit('@setFilter', {
            status: actualStatus.value,
            location: actualLocation.value
        })
    }
</script>

<template>
    <div class="flex items-center justify-center my-1 p-4 rounded-lg">
        <div role="tablist" class="tabs tabs-boxed">
            <a role="tab" :class="{ 'tab-active': actualStatus === 'all' }" class="tab" @click="handleStatus('all')">{{
                $t('all')
            }}</a>
            <a role="tab" :class="{ 'tab-active': actualStatus === 'lost' }" class="tab" @click="handleStatus('lost')">
                {{ $t('lost_f') }}
            </a>
            <a
                role="tab"
                :class="{ 'tab-active': actualStatus === 'found' }"
                @click="handleStatus('found')"
                class="tab"
                >{{ $t('found_f') }}</a
            >
        </div>
        <!-- <div>
      <select class="select select-bordered w-full max-w-xs">
        <option disabled selected>Localidad</option>
        <option>Han Solo</option>
        <option>Greedo</option>
      </select>
    </div> -->
    </div>
</template>
