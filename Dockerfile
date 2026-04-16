# --- Build Stage ---
FROM node:20-slim AS builder
WORKDIR /app

# Install build tools
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libatomic1 \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Install all dependencies including devDependencies
RUN npm ci

COPY . .
RUN cp .env.example .env
RUN npx svelte-kit sync
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# --- Production Stage ---
FROM node:20-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libatomic1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built app
COPY --from=builder /app/build ./build
COPY --from=builder /app/server.mjs .
COPY --from=builder /app/package*.json ./

# Copy the compiled node_modules
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "server.mjs"]