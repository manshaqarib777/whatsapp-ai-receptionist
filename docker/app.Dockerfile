FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Build-only placeholders. Runtime secrets are injected by the platform and are never
# copied from a developer environment into an image layer.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build \
    NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 \
    AUTH_SECRET=build-only-secret-not-valid-at-runtime-123456 \
    EMAIL_TRANSPORT=smtp \
    EMAIL_FROM=build@example.test \
    SMTP_HOST=127.0.0.1 \
    SMTP_USER=build@example.test \
    SMTP_PASSWORD=build-only-password \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run db:generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/api/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
