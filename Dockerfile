## ---------- Build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

## ---------- Runtime stage ----------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl tini

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Bundle Nuxt/Nitro autonome (inclut @prisma/client + binaire engine)
COPY --from=build /app/.output ./.output

# Schéma + migrations + CLI Prisma juste pour exécuter `prisma migrate deploy`
# au démarrage du conteneur. On évite le postinstall (qui appelle nuxt prepare).
COPY package.json ./
COPY prisma ./prisma
RUN npm install --no-save --ignore-scripts --omit=dev --no-audit --no-fund prisma@^6.2.0 \
    && npm cache clean --force

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node .output/server/index.mjs"]
