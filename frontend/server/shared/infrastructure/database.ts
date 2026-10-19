import postgres from 'postgres'

export type Database = postgres.Sql

export function createDatabase(url: string): Database {
    return postgres(url, {
        // Required by transaction-mode poolers such as Supabase's, used from serverless functions.
        prepare: false,
        max: 5,
        idle_timeout: 20,
        transform: { undefined: null },
        types: {
            // Keep `date` columns as YYYY-MM-DD strings instead of Date objects shifted by the timezone.
            date: { to: 1082, from: [1082], serialize: (value: string) => value, parse: (value: string) => value }
        }
    })
}
