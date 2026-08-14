# Milestone 7 — knowledge ingestion worker (AD-3).
#
# A DB-polled worker image. The app itself has no container image yet (the
# project's deployment story is Vercel), so this is a minimal node image that
# installs deps and runs the worker script. The Postgres service is the queue;
# the storage volume is shared with wherever uploads land.
FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching). prisma generate needs the
# schema + the client packages, so copy those too.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# Source. tsx runs the worker; it is a devDependency, so install it without
# pruning in a final layer.
COPY tsconfig.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm install --no-save tsx

# The storage volume is mounted read/write so uploads written by the app API
# (on the host, into the same named volume) are visible here.
VOLUME /app/storage

CMD ["npx", "tsx", "scripts/knowledge-worker.ts"]
