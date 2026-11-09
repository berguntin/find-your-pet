import { z } from 'zod'

/** The signed-in user as the API shows it to themselves. */
export interface MeDto {
    id: string
    /** First name: the only name other people see. */
    name: string
}

/** Deleting the account can also delete every report it created (they stay public, unowned, otherwise). */
export const deleteAccountSchema = z.object({ deletePets: z.boolean().default(false) }).strict()
export type DeleteAccountRequest = z.input<typeof deleteAccountSchema>
