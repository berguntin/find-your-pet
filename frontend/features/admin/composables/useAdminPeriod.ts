import { STATS_PERIODS } from '~~/contracts/admin'

/** The statistics period, kept in the URL (`?dias=7`) so a view can be shared and survives reloads. */
export const useAdminPeriod = () => {
    const route = useRoute()
    const router = useRouter()
    return computed<number>({
        get: () => {
            const days = Number(route.query.dias)
            return (STATS_PERIODS as readonly number[]).includes(days) ? days : 30
        },
        set: days => router.replace({ query: { ...route.query, dias: days === 30 ? undefined : String(days) } })
    })
}
