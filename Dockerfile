# Build Stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Copy .env.example to .env for building
RUN cp .env.example .env

# Generating .svelte-kit folder
RUN npx svelte-kit sync

RUN npm run build

# Production Stage
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.mjs .
COPY package*.json ./
RUN npm install --production

CMD ["node", "server.mjs"]