import postgres from 'postgres';

const {
    DB_USER,
    DB_NAME,
    DB_PASSWORD,
    DB_HOST,
    DB_PORT,
    ENVIRONMENT
} = process.env

const db = postgres({
    host: DB_HOST,
    port: DB_PORT,
    database: DB_NAME,
    username: DB_USER,
    password: DB_PASSWORD,
    ssl: ENVIRONMENT === 'production' // required for supabase conection on prod
        ? { rejectUnauthorized: false }
        : false,
});

export default db;
