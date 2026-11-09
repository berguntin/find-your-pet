import { ValidationError } from '../../../shared/domain/errors'

export type AuthProvider = 'google'

/** The account a person signs in with, as the provider reports it. */
export interface ExternalIdentity {
    provider: AuthProvider
    /** Stable id at the provider (Google `sub`); emails can change, this cannot. */
    subject: string
    email: string
    /** Given name if the provider has one, otherwise the full name. */
    name: string
}

/** Data minimisation: no email or photo is stored, only what other people may see (the first name). */
export interface UserProps {
    id: string
    displayName: string
    createdAt: Date
}

const MAX_DISPLAY_NAME = 80

/** Someone who signed in, known by their provider account; only the first name is kept. */
export class User {
    private constructor(private props: UserProps) {}

    static register(identity: ExternalIdentity, { id, now }: { id: string; now: Date }): User {
        return new User({ id, displayName: User.publicName(identity), createdAt: now })
    }

    static restore(props: UserProps): User {
        return new User({ ...props })
    }

    /** First word of the name (no surnames in public), or the email's local part as a last resort. */
    static publicName({ name, email }: Pick<ExternalIdentity, 'name' | 'email'>): string {
        const first = name.trim().split(/\s+/)[0] || email.split('@')[0] || ''
        const displayName = first.slice(0, MAX_DISPLAY_NAME)
        if (!displayName) throw new ValidationError('The account has no usable name')
        return displayName
    }

    get id(): string {
        return this.props.id
    }

    get displayName(): string {
        return this.props.displayName
    }

    /** Keeps the name in step with the provider. Returns whether it changed. */
    refreshFrom(identity: ExternalIdentity): boolean {
        const displayName = User.publicName(identity)
        if (displayName === this.props.displayName) return false
        this.props = { ...this.props, displayName }
        return true
    }

    toSnapshot(): UserProps {
        return { ...this.props }
    }
}
