const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 365],
    ['month', 30],
    ['week', 7],
    ['day', 1]
]

/**
 * "hoy", "ayer", "hace 3 días"... for a YYYY-MM-DD date. Days are counted in UTC so the result
 * does not depend on the server or browser timezone.
 */
export function formatRelativeDate(date: string, locale: string, now: Date = new Date()): string {
    const [year, month, dayOfMonth] = date.slice(0, 10).split('-').map(Number) as [number, number, number]
    const day = Date.UTC(year, month - 1, dayOfMonth)
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    const days = Math.round((day - today) / 86_400_000)
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    for (const [unit, size] of UNITS) {
        if (Math.abs(days) >= size || unit === 'day') return format.format(Math.trunc(days / size), unit)
    }
    return format.format(days, 'day')
}
