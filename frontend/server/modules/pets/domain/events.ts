import type { RecordedEvent } from '../../../shared/domain/events'

/** The pet became visible to everyone (approved automatically or by an admin). */
export type PetPublished = RecordedEvent<'pet.published', { petId: string }>

/** The pet is back with its family. */
export type PetReunited = RecordedEvent<'pet.reunited', { petId: string }>

/** A published pet's details changed: its search vectors must be rebuilt. */
export type PetEdited = RecordedEvent<'pet.edited', { petId: string }>

/** An admin hid a published pet again: it must leave the search index. */
export type PetUnpublished = RecordedEvent<'pet.unpublished', { petId: string }>

export type PetEvent = PetPublished | PetReunited | PetEdited | PetUnpublished
