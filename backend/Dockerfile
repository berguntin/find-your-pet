FROM node:22-alpine AS development

WORKDIR /app

COPY .env /app/

CMD ["sh", "-c", "npm i && npm run dev"]