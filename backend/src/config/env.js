const required = [
  'DB_USER',
  'DB_NAME',
  'DB_PASSWORD',
  'DB_HOST',
  'DB_PORT',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RECAPTCHA_SECRET_KEY',
];

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
