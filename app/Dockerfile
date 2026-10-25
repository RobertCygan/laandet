# syntax=docker/dockerfile:1.7
#
# Laandet application image (P01-13). One image, two kinds of process:
#   app     node server.js                         (Next.js standalone server, port 3000, working dir /app)
#   tools   node <file>.mjs                        (working dir /app/tools)
#             worker/index.mjs                     background worker (ARCHITECTURE.md §4.11)
#             scripts/migrate.mjs                  migrations, owner role (DATABASE_MIGRATION_URL)
#             scripts/load-legal.mjs               legal texts from /app/legal (D-023)
#             scripts/grant-role.mjs               staff roles (AUTH_MODEL §2)
#             scripts/seed.mjs                     reference data (+ --demo for staging)
# The tools are the same TypeScript sources that `npm run worker` etc. run through tsx in
# development, bundled with esbuild so the image needs no second node_modules tree.
#
# Build from the laandet/ directory (the legal texts live outside the app directory):
#   docker buildx build -f app/Dockerfile --build-context legal=legal -t laandet-app:dev app
#
# The base image is pinned by digest (SEC-61). To update: pick the new tag, read its digest
# (`docker buildx imagetools inspect node:<version>-bookworm-slim`) and change NODE_IMAGE.
# Debian (glibc) rather than Alpine, so sharp's prebuilt binaries work without extra packages.
ARG NODE_IMAGE=node:22.23.4-bookworm-slim@sha256:de170b39439eb0e5a3444ad7d60b015614a381e10fecae2e30ec9e735122f38d

# ---------------------------------------------------------------- dependencies
FROM ${NODE_IMAGE} AS deps
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------- build
FROM ${NODE_IMAGE} AS build
WORKDIR /src
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /src/node_modules ./node_modules
COPY . .
# Environment validation uses build-phase defaults (src/modules/config/env.ts): no secrets are needed or baked in.
RUN npm run build
# sharp stays external: it is resolved at runtime from the standalone node_modules in /app.
RUN ./node_modules/.bin/esbuild worker/index.ts scripts/migrate.ts scripts/load-legal.ts scripts/grant-role.ts scripts/seed.ts \
      --bundle --platform=node --target=node22 --format=esm \
      --outdir=dist-tools --out-extension:.js=.mjs \
      --external:sharp --external:pg-native \
      --banner:js="import { createRequire as __laandetCreateRequire } from 'node:module'; const require = __laandetCreateRequire(import.meta.url);" \
      --log-level=warning

# ---------------------------------------------------------------- runtime
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    MEDIA_DIR=/data/media \
    LEGAL_DIR=/app/legal
WORKDIR /app

# Everything below is owned by root and read-only for the runtime user.
COPY --from=build /src/.next/standalone ./
COPY --from=build /src/.next/static ./.next/static
COPY --from=build /src/public ./public
COPY --from=build /src/dist-tools ./tools
COPY drizzle ./tools/drizzle
COPY seed ./tools/seed
COPY --from=legal . ./legal

# The only writable paths at runtime are /data/media (volume) and /tmp (tmpfs); see deploy/compose.yaml.
# Next.js may write a cache under .next/cache, which is redirected into /tmp.
RUN mkdir -p /data/media && chown node:node /data/media \
 && ln -s /tmp/next-cache /app/.next/cache

USER node
EXPOSE 3000
VOLUME ["/data/media"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
