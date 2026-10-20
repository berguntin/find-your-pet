import type { PetProps } from './Pet'

/** Long descriptions are cut so the call to action stays visible without expanding the post. */
export const SOCIAL_DESCRIPTION_MAX_LENGTH = 500

const SPECIES_TEXT = { dog: 'Perro', cat: 'Gato', other: 'Animal' } as const

type SocialPostPet = Pick<
    PetProps,
    'reportType' | 'species' | 'name' | 'description' | 'location' | 'eventDate' | 'alive' | 'resolution'
>

/**
 * Text of the post that announces a pet on social networks, in Spanish like the reports. The contact
 * is left out on purpose: it is on the pet's page, so it is not spread to another platform.
 */
export function socialPostMessage(pet: SocialPostPet, petUrl: string): string {
    const headline = [reportLabel(pet), SPECIES_TEXT[pet.species], pet.name].filter(Boolean).join(' · ')
    const body = [
        headline,
        `📍 ${pet.location} · 📅 ${formatDate(pet.eventDate)}`,
        truncate(pet.description, SOCIAL_DESCRIPTION_MAX_LENGTH),
        `ℹ️ Más información y contacto: ${petUrl}`,
        pet.resolution === 'open' ? '🔁 Compártelo en los grupos de mascotas de tu zona.' : ''
    ]
        .filter(Boolean)
        .join('\n\n')

    return pet.resolution === 'reunited' ? `✅ ¡YA ESTÁ EN CASA! Gracias por compartir.\n\n${body}` : body
}

function reportLabel(pet: SocialPostPet): string {
    if (pet.reportType === 'lost') return '🔴 PERDIDO'
    return pet.alive ? '🟢 ENCONTRADO' : 'ENCONTRADO SIN VIDA'
}

/** YYYY-MM-DD to DD/MM/YYYY, the format readers in Spain expect. */
function formatDate(isoDate: string): string {
    const [year, month, day] = isoDate.split('-')
    return `${day}/${month}/${year}`
}

function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 1).trimEnd()}…`
}
