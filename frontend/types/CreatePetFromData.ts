export interface CreatePetFormData {
    type: string
    images: File[]
    description: string
    name: string
    breed: string
    status: 'lost' | 'found'
    location: string
    alive: boolean
    contact: string
    date: string
}
