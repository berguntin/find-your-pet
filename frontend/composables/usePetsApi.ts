import type {
    DescribePetRequest,
    ListPetsQuery,
    PetDescriptionDto,
    PetDto,
    PetPageDto,
    ReportPetRequest,
    UploadAuthorizationDto
} from '~~/contracts/pets'

/** Typed client for the pets API. Pages and components never build API URLs themselves. */
export const usePetsApi = () => ({
    list: (query: ListPetsQuery = {}) => $fetch<PetPageDto>('/api/v1/pets', { query }),

    report: (body: ReportPetRequest) => $fetch<PetDto>('/api/v1/pets', { method: 'POST', body }),

    describe: (image: DescribePetRequest['image']) =>
        $fetch<PetDescriptionDto>('/api/v1/pets/describe', { method: 'POST', body: { image } }),

    /** Uploads straight to the image storage with a server-signed authorization and returns the image URL. */
    uploadImage: async (image: Blob) => {
        const { uploadUrl, fields } = await $fetch<UploadAuthorizationDto>('/api/v1/uploads/signature', {
            method: 'POST'
        })
        const form = new FormData()
        Object.entries(fields).forEach(([key, value]) => form.append(key, value))
        form.append('file', image)

        const { secure_url } = await $fetch<{ secure_url: string }>(uploadUrl, { method: 'POST', body: form })
        return secure_url
    }
})
