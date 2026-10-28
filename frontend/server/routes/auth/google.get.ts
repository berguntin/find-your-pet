import { consola } from 'consola'
import { sendRedirect } from 'h3'
import { useContainer } from '../../container'
import { isAdminEmail } from '../../shared/infrastructure/adminEmails'

/**
 * Google sign-in for the admin panel. Only verified emails on NUXT_ADMIN_EMAILS get a session; the
 * allowlist is checked again on every admin request, so removing an email revokes access at once.
 * The OAuth and session helpers are Nitro auto-imports from nuxt-auth-utils.
 */
export default defineOAuthGoogleEventHandler({
    config: { scope: ['openid', 'email', 'profile'] },
    async onSuccess(event, { user }) {
        const { adminAccess } = useContainer()
        if (!user.email_verified || !isAdminEmail(user.email, adminAccess.adminEmails)) {
            await clearUserSession(event)
            return sendRedirect(event, '/admin/login?error=forbidden')
        }

        await setUserSession(event, {
            user: {
                email: String(user.email).toLowerCase(),
                name: user.name ?? user.email,
                picture: user.picture ?? null
            },
            loggedInAt: new Date().toISOString()
        })
        return sendRedirect(event, '/admin')
    },
    onError(event, error) {
        consola.error('[google-login]', error)
        return sendRedirect(event, '/admin/login?error=oauth')
    }
})
