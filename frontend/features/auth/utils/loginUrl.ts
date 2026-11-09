/** Google sign-in URL that brings the person back to `returnTo` (a same-site path) afterwards. */
export function loginUrl(returnTo: string): string {
    return `/auth/google?returnTo=${encodeURIComponent(returnTo)}`
}

/** `value` if it is a path on this site, otherwise `/`. The server applies the same rule on sign-in. */
export function sameSitePath(value: unknown): string {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
        return '/'
    return value
}
