/** The admin allowlist: Google accounts allowed into the admin panel. */

/** Comma-separated emails from the environment, normalised for comparison. */
export function parseEmailList(value: string | undefined): string[] {
    return (value ?? '')
        .split(',')
        .map(email => email.trim().toLowerCase())
        .filter(email => email.length > 0)
}

export function isAdminEmail(email: string | null | undefined, adminEmails: string[]): boolean {
    return !!email && adminEmails.includes(email.trim().toLowerCase())
}
