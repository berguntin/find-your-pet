import type {
    AdminListPetsQuery,
    AdminPetDto,
    AdminPetPageDto,
    AdminUpdatePetRequest,
    ModeratePetRequest,
    ModerationOverviewDto,
    PetStatsDto
} from '~~/contracts/admin'

/** Typed client for the admin API. The session cookie authenticates every call. */
export const useAdminApi = () => {
    // During SSR the browser's cookie has to be forwarded explicitly.
    const fetcher = useRequestFetch()
    const pet = (id: string) => `/api/v1/admin/pets/${encodeURIComponent(id)}`

    return {
        listPets: (query: AdminListPetsQuery = {}) => fetcher<AdminPetPageDto>('/api/v1/admin/pets', { query }),

        getPet: (id: string) => fetcher<AdminPetDto>(pet(id)),

        updatePet: (id: string, body: AdminUpdatePetRequest) =>
            fetcher<AdminPetDto>(pet(id), { method: 'PATCH', body }),

        /** Resolves to null when the report was rejected (and therefore deleted). */
        moderatePet: (id: string, status: ModeratePetRequest['status']) =>
            fetcher<AdminPetDto | null>(`${pet(id)}/moderation`, { method: 'PATCH', body: { status } }),

        deletePet: (id: string) => fetcher<null>(`/api/v1/pets/${encodeURIComponent(id)}`, { method: 'DELETE' }),

        stats: (days: number) => fetcher<PetStatsDto>('/api/v1/admin/stats', { query: { days } }),

        moderation: (days: number) => fetcher<ModerationOverviewDto>('/api/v1/admin/moderation', { query: { days } })
    }
}
