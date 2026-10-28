<script setup lang="ts">
    const props = defineProps<{
        /** One row per day: `day` (YYYY-MM-DD) plus a count per series key. */
        rows: ({ day: string } & Record<string, number | string>)[]
        series: ChartSeries[]
        /** Accessible name of the chart; the visible title lives in the parent. */
        label: string
    }>()

    const { locale, t } = useI18n()

    const value = (row: (typeof props.rows)[number], key: string) => Number(row[key] ?? 0)
    const totals = computed(() => props.rows.map(row => props.series.reduce((sum, s) => sum + value(row, s.key), 0)))
    const max = computed(() => niceMax(Math.max(0, ...totals.value)))
    const ticks = computed(() => [max.value, max.value / 2, 0])

    const dayFormat = computed(
        () => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' })
    )
    const longDayFormat = computed(
        () => new Intl.DateTimeFormat(locale.value, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    )
    const formatDay = (day: string, long = false) =>
        (long ? longDayFormat : dayFormat).value.format(new Date(`${day}T00:00:00Z`))

    // A few evenly spaced date labels, always including the first and the last day.
    const labelled = computed(() => {
        const count = props.rows.length
        const every = Math.max(1, Math.ceil(count / 6))
        return new Set(
            props.rows.map((_, i) => i).filter(i => i === count - 1 || (i % every === 0 && count - 1 - i >= every / 2))
        )
    })

    const active = ref<number | null>(null)
    const showTable = ref(false)
</script>

<template>
    <div>
        <ul class="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm" :aria-label="t('admin_chart_legend')">
            <li v-for="s in series" :key="s.key" class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm" :style="{ background: s.color }" aria-hidden="true" />
                {{ s.label }}
            </li>
        </ul>

        <div v-if="!showTable" class="relative" role="img" :aria-label="label">
            <div class="flex h-48 gap-2">
                <!-- Y axis -->
                <div
                    class="flex w-8 flex-col justify-between text-right text-xs tabular-nums text-muted"
                    aria-hidden="true"
                >
                    <!-- Counts are whole numbers: a half tick like 2.5 keeps its gridline but not its label. -->
                    <span v-for="tick in ticks" :key="tick" class="-my-2">{{
                        Number.isInteger(tick) ? tick : ''
                    }}</span>
                </div>
                <!-- Plot -->
                <div class="relative flex-1">
                    <div class="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
                        <div
                            v-for="tick in ticks"
                            :key="tick"
                            class="border-t"
                            :class="tick === 0 ? 'border-base-content/30' : 'border-base-300/70'"
                        />
                    </div>
                    <div class="absolute inset-0 flex items-stretch gap-px">
                        <div
                            v-for="(row, index) in rows"
                            :key="row.day"
                            class="relative flex flex-1 cursor-default flex-col justify-end rounded-sm px-[1px] outline-none"
                            :class="active === index ? 'bg-base-content/5' : ''"
                            tabindex="0"
                            :aria-label="`${formatDay(row.day, true)}: ${series
                                .map(s => `${s.label} ${value(row, s.key)}`)
                                .join(', ')}`"
                            @mouseenter="active = index"
                            @mouseleave="active = null"
                            @focus="active = index"
                            @blur="active = null"
                        >
                            <div class="mx-auto flex w-full max-w-6 flex-col-reverse gap-[2px]">
                                <template v-for="s in series" :key="s.key">
                                    <div
                                        v-if="value(row, s.key) > 0"
                                        class="w-full last:rounded-t"
                                        :style="{
                                            height: `${(value(row, s.key) / max) * 192}px`,
                                            minHeight: '2px',
                                            background: s.color
                                        }"
                                    />
                                </template>
                            </div>

                            <div
                                v-if="active === index"
                                class="pointer-events-none absolute top-0 z-10 w-max min-w-36 rounded-xl border border-base-300 bg-base-100 p-3 text-sm shadow-lg"
                                :class="index > rows.length / 2 ? 'right-full mr-2' : 'left-full ml-2'"
                                role="tooltip"
                            >
                                <p class="mb-1 font-bold first-letter:uppercase">{{ formatDay(row.day, true) }}</p>
                                <p v-for="s in series" :key="s.key" class="flex items-center justify-between gap-4">
                                    <span class="flex items-center gap-1.5">
                                        <span
                                            class="inline-block h-2.5 w-2.5 rounded-sm"
                                            :style="{ background: s.color }"
                                        />
                                        {{ s.label }}
                                    </span>
                                    <span class="font-bold tabular-nums">{{ value(row, s.key) }}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <!-- X axis -->
            <div class="ml-10 mt-1 flex gap-px text-xs text-muted" aria-hidden="true">
                <span v-for="(row, index) in rows" :key="row.day" class="relative flex-1">
                    <span v-if="labelled.has(index)" class="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                        {{ formatDay(row.day) }}
                    </span>
                </span>
            </div>
        </div>

        <div v-else class="max-h-72 overflow-auto rounded-xl border border-base-300">
            <table class="table table-xs">
                <caption class="sr-only">
                    {{
                        label
                    }}
                </caption>
                <thead>
                    <tr>
                        <th scope="col">{{ t('admin_day') }}</th>
                        <th v-for="s in series" :key="s.key" scope="col" class="text-right">{{ s.label }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in [...rows].reverse()" :key="row.day">
                        <th scope="row" class="font-normal">{{ formatDay(row.day) }}</th>
                        <td v-for="s in series" :key="s.key" class="text-right tabular-nums">
                            {{ value(row, s.key) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>

        <button type="button" class="btn btn-ghost btn-xs mt-5" @click="showTable = !showTable">
            <Icon :name="showTable ? 'mdi:chart-bar' : 'mdi:table'" />
            {{ showTable ? t('admin_show_chart') : t('admin_show_table') }}
        </button>
    </div>
</template>
