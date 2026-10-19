FROM node:24-alpine AS development
WORKDIR /app

# Runs pending migrations, then the dev server. The .env file is provided by compose, never baked in.
CMD ["sh", "-c", "npm install && npm run db:migrate && npm run dev -- --host 0.0.0.0"]
