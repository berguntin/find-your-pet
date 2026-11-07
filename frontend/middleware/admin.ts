/**
 * Admin pages need an admin session; the API still checks the allowlist on every request. Sessions from
 * before user accounts have no `admin` flag: those sign in again, without a "forbidden" message.
 */
export default defineNuxtRouteMiddleware(async () => {
    const { loggedIn, user, fetch } = useUserSession()
    if (!loggedIn.value) await fetch()
    if (!loggedIn.value || user.value?.admin === undefined) return navigateTo('/admin/login')
    if (!user.value.admin) return navigateTo('/admin/login?error=forbidden')
})
