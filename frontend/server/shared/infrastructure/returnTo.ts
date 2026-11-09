/**
 * Where to send someone after signing in. Only same-site paths are accepted, so the sign-in link
 * cannot be abused to redirect people to another site (open redirect).
 */
export function safeReturnTo(value: unknown, fallback = '/'): string {
    if (typeof value !== 'string' || value.length > 500) return fallback
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
    // Printable ASCII only: control characters (tabs, new lines) let browsers turn "/\t/evil.com" into
    // "//evil.com", and non-ASCII ones cannot go in a Location header.
    if (!/^[\x21-\x7e]+$/.test(value)) return fallback
    if (value.startsWith('/auth/')) return fallback
    return value
}
