# syntax=docker/dockerfile:1
FROM node:22-slim

WORKDIR /app

# Prisma's engine needs libssl; node:22-slim doesn't ship it by default.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first so Docker layer caching skips reinstalls when
# only application code changes.
COPY package.json package-lock.json ./
RUN npm ci

# Generate the Prisma client (needs the schema before the rest of the code).
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["npm", "start"]
