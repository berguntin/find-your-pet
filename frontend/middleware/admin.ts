/** Admin pages need a panel session; the API still checks the allowlist on every request. */
export default defineNuxtRouteMiddleware(async () => {
    const { loggedIn, fetch } = useUserSession()
    if (!loggedIn.value) await fetch()
    if (!loggedIn.value) return navigateTo('/admin/login')
})
