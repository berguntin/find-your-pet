/**
 * Who is performing an action. Anonymous visitors can report pets; managing a pet requires being its owner
 * or an admin. An admin signed in with Google also has a user account (`userId`); one using the token does not.
 */
export type Actor = { kind: 'anonymous' } | { kind: 'admin'; userId?: string } | { kind: 'user'; userId: string }

/** The user account behind the actor, if any. */
export function actorUserId(actor: Actor): string | null {
    return actor.kind === 'anonymous' ? null : actor.userId ?? null
}
