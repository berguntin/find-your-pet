/**
 * Who is performing an action. Anonymous visitors can report pets; managing a pet
 * requires being its owner (once login exists) or an admin.
 */
export type Actor = { kind: 'anonymous' } | { kind: 'admin' } | { kind: 'user'; userId: string }
