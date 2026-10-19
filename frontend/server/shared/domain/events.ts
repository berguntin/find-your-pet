/**
 * Something that happened in the domain and other modules may react to (index images, send emails...).
 * Aggregates record them; repositories store them in the outbox in the same transaction as the change.
 */
export interface DomainEvent<TType extends string = string, TPayload = Record<string, unknown>> {
    id: string
    type: TType
    occurredAt: Date
    payload: TPayload
}

/** An event as recorded by an aggregate; the outbox assigns its id when storing it. */
export type RecordedEvent<TType extends string = string, TPayload = Record<string, unknown>> = Omit<
    DomainEvent<TType, TPayload>,
    'id'
>
