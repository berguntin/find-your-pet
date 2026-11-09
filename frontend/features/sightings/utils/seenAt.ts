/** Value for an `<input type="datetime-local">` (local time, minutes) from a date. */
export function toDateTimeLocal(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0')
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
        `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    )
}

/** ISO 8601 instant for the API from a datetime-local value (read in the browser's time zone). */
export function fromDateTimeLocal(value: string): string | null {
    const date = new Date(value)
    return value && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

/** How a sighting's support reads: verified (and by whom) or how many points it has so far. */
export function sightingSupport(
    sighting: { verified: boolean; verifiedBy: 'community' | 'owner' | null; points: number },
    threshold: number
): { kind: 'owner' | 'community' | 'progress'; points: number; threshold: number } {
    if (sighting.verified)
        return { kind: sighting.verifiedBy === 'owner' ? 'owner' : 'community', points: sighting.points, threshold }
    return { kind: 'progress', points: Math.min(sighting.points, threshold), threshold }
}
