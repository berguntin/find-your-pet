FROM node:22-alpine AS development
WORKDIR /app

RUN npm install -g nodemon

CMD ["sh", "-c", "npm ci && npm run dev"]
