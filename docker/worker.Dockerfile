# All durable PostgreSQL-backed consumers for the hybrid Vercel deployment.
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src

RUN mkdir -p /app/storage && chown -R node:node /app
USER node

CMD ["npm", "run", "workers:work"]
