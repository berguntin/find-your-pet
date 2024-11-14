/* import type { UseFetchOptions } from 'nuxt/app'
import type { ApiResponse } from '~/types/ApiResponse'
import { useFetch } from 'nuxt/app'

export async function savePet(formData: FormData): Promise<ApiResponse> {
  const config: UseFetchOptions<ApiResponse> = {
    method: 'POST',
    body: formData,
  }

  try {
    const { data, error } = await useFetch<ApiResponse>('/api/pets', config)

    if (error.value) {
      console.error('Error saving pet:', error.value)
      return { ok: false, error: error.value.message }
    }

    if (!data.value) {
      return { ok: false, error: 'No data received from server' }
    }

    return { ok: true, data: data.value }
  } catch (e) {
    console.error('Unexpected error:', e)
    return { ok: false, error: 'An unexpected error occurred' }
  }
} */