import type { DeleteAccountRequest } from '~~/contracts/users'

/** Typed client for the signed-in user's own account. */
export const useAccountApi = () => ({
    deleteAccount: (body: DeleteAccountRequest) => $fetch<null>('/api/v1/me', { method: 'DELETE', body })
})
