/** Change from `previous` to `current` as a rounded percentage; null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100)
}

/** Share of `part` in `total` as a rounded percentage (0 when the total is 0). */
export function percentOf(part: number, total: number): number {
    return total === 0 ? 0 : Math.round((part / total) * 100)
}

/** A 0..1 probability as a percentage, or a dash when the moderator gave none. */
export function formatProbability(value: number | null | undefined): string {
    return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`
}

/** "Nice" upper bound for a chart axis: 1, 2 or 5 times a power of ten, at least 1. */
export function niceMax(value: number): number {
    if (value <= 1) return 1
    const power = 10 ** Math.floor(Math.log10(value))
    const step = [1, 2, 5, 10].find(multiple => multiple * power >= value)!
    return step * power
}
