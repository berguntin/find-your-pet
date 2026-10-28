// Shape of the session nuxt-auth-utils keeps in a sealed cookie (see server/routes/auth/google.get.ts).
declare module '#auth-utils' {
    interface User {
        email: string
        name: string
        picture: string | null
    }

    interface UserSession {
        loggedInAt: string
    }
}

export {}
