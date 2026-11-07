/**
 * Sightings are public messages on someone else's notice: the classic "I have your dog, send money" scam
 * would fit right in. Anything that looks like contact details, links or payment talk never gets
 * published automatically; an admin reviews it first. Contact happens through the notice, not sightings.
 */
const PATTERNS: RegExp[] = [
    // Phone numbers: 9+ digits, possibly with spaces, dots, dashes or a +34 prefix.
    /(?:\+\s?\d{1,3}[\s.-]?)?(?:\d[\s.-]?){8,}\d/,
    // Emails and links.
    /[\w.+-]+@[\w-]+\.[\w.]+/,
    /\b(?:https?:\/\/|www\.)\S+/i,
    /\b[\w-]+\.(?:com|es|net|org|me|ly|io|link)\b/i,
    // Money and payment.
    /[€$]|\d\s?(?:euros?|eur)\b/i,
    /\b(?:recompensa|gratificaci[oó]n|reward|bizum|iban|transferencia|transfer|paypal|pago|pagar|payment|pay|dinero|money|ingreso)\b/i,
    // Moving the conversation elsewhere.
    /\b(?:whats\s?app|telegram|signal|ll[aá]mame|escr[ií]beme|call me|text me|dm)\b/i
]

export function looksLikeContactOrPayment(...texts: string[]): boolean {
    return texts.some(text => PATTERNS.some(pattern => pattern.test(text)))
}
