# 24.18 is the first Node 24 release bundling npm 11.16, which the .npmrc supply-chain settings need.
FROM node:24.22-alpine AS development
WORKDIR /app

# Runs pending migrations, then the dev server. The .env file is provided by compose, never baked in.
CMD ["sh", "-c", "npm install && npm run db:migrate && npm run dev -- --host 0.0.0.0"]
