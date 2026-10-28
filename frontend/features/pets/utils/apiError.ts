import { FetchError } from 'ofetch'
import type { ApiErrorDto } from '~~/contracts/pets'

export type ApiErrorCode = ApiErrorDto['error']['code']

/** The error code of a failed API call, or undefined for network errors and unexpected responses. */
export function apiErrorCode(error: unknown): ApiErrorCode | undefined {
    if (!(error instanceof FetchError)) return undefined
    return (error.data as Partial<ApiErrorDto> | undefined)?.error?.code
}
