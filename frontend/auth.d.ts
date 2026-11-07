// Shape of the session nuxt-auth-utils keeps in a sealed cookie (see server/routes/auth/google.get.ts).
declare module '#auth-utils' {
    interface User {
        /** Account id; missing in sessions created before user accounts existed. */
        id?: string
        /** Only ever shown to its owner (the session endpoint returns the signed-in user's own data). */
        email: string
        /** First name, the only name shown to other people. */
        name: string
        picture: string | null
        /** For the UI only (showing the admin link); the API checks the allowlist on every request. */
        admin?: boolean
    }

    interface UserSession {
        loggedInAt: string
    }
}

export {}
