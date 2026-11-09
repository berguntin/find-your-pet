import type { ReportSightingRequest, SightingDto, SightingListDto } from '~~/contracts/sightings'

/** Typed client for pet sightings. */
export const useSightingsApi = () => ({
    list: (petId: string) => $fetch<SightingListDto>(`/api/v1/pets/${encodeURIComponent(petId)}/sightings`),

    report: (petId: string, body: ReportSightingRequest) =>
        $fetch<SightingDto>(`/api/v1/pets/${encodeURIComponent(petId)}/sightings`, { method: 'POST', body }),

    validate: (sightingId: string) =>
        $fetch<SightingDto>(`/api/v1/sightings/${encodeURIComponent(sightingId)}/validations`, { method: 'POST' }),

    /** For the pet's owner: hides the sighting until an admin reviews it. */
    hide: (sightingId: string) =>
        $fetch<{ id: string; moderationStatus: string }>(`/api/v1/sightings/${encodeURIComponent(sightingId)}/hide`, {
            method: 'POST'
        }),

    remove: (sightingId: string) =>
        $fetch<null>(`/api/v1/sightings/${encodeURIComponent(sightingId)}`, { method: 'DELETE' })
})
