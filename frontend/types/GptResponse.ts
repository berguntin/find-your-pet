export interface GptResponse {
    error: boolean
    data : {
        type: string | null 
        description: string | null 
        name: string | null
        location: string | null 
        contact: string | null 
        date: string | null
    }
}