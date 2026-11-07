import { consola } from 'consola'
import { defineEventHandler, deleteCookie, getCookie, getQuery, sendRedirect, setCookie, type H3Event } from 'h3'
import { useContainer } from '../../container'
import { isAdminEmail } from '../../shared/infrastructure/adminEmails'
import { safeReturnTo } from '../../shared/infrastructure/returnTo'

const RETURN_TO_COOKIE = 'auth_return_to'

/**
 * Google sign-in for everyone. The first sign-in creates the user account; the session keeps its id, the
 * first name and whether the email is an admin one (for the UI only: the API re-checks the allowlist on
 * every request). The OAuth and session helpers are Nitro auto-imports from nuxt-auth-utils.
 */
const google = defineOAuthGoogleEventHandler({
    config: { scope: ['openid', 'email', 'profile'] },
    async onSuccess(event, { user }) {
        const returnTo = takeReturnTo(event)
        if (!user.email_verified || typeof user.sub !== 'string' || typeof user.email !== 'string') {
            await clearUserSession(event)
            return sendRedirect(event, '/entrar?error=unverified')
        }

        const { access, users } = useContainer()
        const account = await users.signIn.execute({
            provider: 'google',
            subject: user.sub,
            email: user.email,
            name: typeof user.given_name === 'string' && user.given_name ? user.given_name : String(user.name ?? '')
        })

        await replaceUserSession(event, {
            user: {
                id: account.id,
                email: String(user.email).toLowerCase(),
                name: account.displayName,
                picture: typeof user.picture === 'string' ? user.picture : null,
                admin: isAdminEmail(user.email, access.adminEmails)
            },
            loggedInAt: new Date().toISOString()
        })
        return sendRedirect(event, returnTo)
    },
    onError(event, error) {
        consola.error('[google-login]', error.message)
        const returnTo = takeReturnTo(event)
        return sendRedirect(event, returnTo.startsWith('/admin') ? '/admin/login?error=oauth' : '/entrar?error=oauth')
    }
})

export default defineEventHandler(event => {
    // First leg (no `code` yet): remember where to come back to, since Google only returns to this route.
    const query = getQuery(event)
    if (query.code === undefined && query.error === undefined) {
        setCookie(event, RETURN_TO_COOKIE, safeReturnTo(query.returnTo), {
            httpOnly: true,
            sameSite: 'lax',
            secure: !import.meta.dev,
            path: '/auth',
            maxAge: 600
        })
    }
    return google(event)
})

function takeReturnTo(event: H3Event): string {
    // On the first leg the cookie is not in the request yet, so fall back to the query.
    const returnTo = safeReturnTo(getCookie(event, RETURN_TO_COOKIE) ?? getQuery(event).returnTo)
    deleteCookie(event, RETURN_TO_COOKIE, { path: '/auth' })
    return returnTo
}
