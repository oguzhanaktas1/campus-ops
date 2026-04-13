FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate

COPY nest-cli.json tsconfig*.json ./
COPY src ./src

RUN npm run build

FROM builder AS prunedbuilder

RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY --from=prunedbuilder /app/node_modules ./node_modules
COPY --from=prunedbuilder /app/dist ./dist

EXPOSE 5000

CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then npx prisma migrate deploy; fi && node dist/src/main.js"]
