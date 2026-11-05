export type ContactActionKind = 'phone' | 'whatsapp' | 'email' | 'instagram' | 'link'

export interface ContactAction {
    kind: ContactActionKind
    href: string
    /** What to show: the number, address or handle. */
    label: string
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
const URL_PATTERN = /https?:\/\/\S+/i
const HANDLE = /(?:^|\s)@([a-z0-9._]{2,30})\b/i
const PHONE = /(?:\+?\d[\d\s.-]{7,}\d)/

/**
 * Turns the free-text contact of a report into buttons: call and WhatsApp for phones,
 * email, Instagram for @handles and plain links. Unknown formats return no actions,
 * and the page shows the text as written.
 */
export function contactActions(contact: string): ContactAction[] {
    const text = contact.trim()
    const actions: ContactAction[] = []

    const email = text.match(EMAIL)?.[0]
    if (email) actions.push({ kind: 'email', href: `mailto:${email}`, label: email })

    const url = text.match(URL_PATTERN)?.[0]
    if (url) actions.push({ kind: 'link', href: url, label: url.replace(/^https?:\/\//i, '') })

    const handle = !email ? text.match(HANDLE)?.[1] : undefined
    if (handle) {
        actions.push({ kind: 'instagram', href: `https://instagram.com/${handle}`, label: `@${handle}` })
    }

    const phone = !url ? text.match(PHONE)?.[0] : undefined
    if (phone) {
        const digits = phone.replace(/[^\d+]/g, '')
        // Spanish numbers are usually written without the country code.
        const international = digits.startsWith('+') ? digits.slice(1) : digits.length === 9 ? `34${digits}` : digits
        actions.push({ kind: 'phone', href: `tel:+${international}`, label: phone.trim() })
        actions.push({ kind: 'whatsapp', href: `https://wa.me/${international}`, label: phone.trim() })
    }

    return actions
}
