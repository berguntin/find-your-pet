import type { RecordedEvent } from '../../../shared/domain/events'

/** The pet became visible to everyone (approved automatically or by an admin). */
export type PetPublished = RecordedEvent<'pet.published', { petId: string }>

/** The pet is back with its family. */
export type PetReunited = RecordedEvent<'pet.reunited', { petId: string }>

export type PetEvent = PetPublished | PetReunited
