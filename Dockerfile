# syntax=docker/dockerfile:1
#
# Production image for the Toolwright web app (Next.js standalone output).
#
#   docker build -t toolwright \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://toolwright.com \
#     --build-arg NEXT_PUBLIC_REPO_URL=https://github.com/your-org/toolwright .
#   docker run -p 3000:3000 -e DATABASE_URL=postgres://... toolwright
#
# Database migrations (optional one-off job, needs DATABASE_URL):
#   docker build --target migrate -t toolwright-migrate .
#   docker run --rm -e DATABASE_URL=postgres://... toolwright-migrate
#
# See docs/maintainers.md.

ARG NODE_VERSION=22

# ---------- build: install dependencies and compile ----------
FROM node:${NODE_VERSION}-alpine AS build
WORKDIR /app

# Copy only the manifests first so the dependency layer is cached until they change.
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/tools/package.json packages/tools/
COPY packages/ui/package.json packages/ui/
# Retries make the install resilient to flaky networks in CI.
ENV npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=20000 \
    npm_config_fetch_retry_maxtimeout=120000
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .

# NEXT_PUBLIC_* values are inlined into the browser bundle, so they must be known at build time.
ARG NEXT_PUBLIC_SITE_URL=https://toolwright.com
ARG NEXT_PUBLIC_REPO_URL=https://github.com/RaydanAridiCS/toolwright
# Build workers: lower this if the build is killed for lack of memory, raise it for faster builds.
ARG NEXT_BUILD_CPUS=4
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_REPO_URL=$NEXT_PUBLIC_REPO_URL \
    NEXT_BUILD_CPUS=$NEXT_BUILD_CPUS \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
RUN npm run build

# ---------- migrate: optional one-off job that applies SQL migrations ----------
FROM build AS migrate
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate"]

# ---------- runner: the small image that actually serves traffic ----------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# The standalone folder contains the server plus only the node_modules it needs.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Static assets and public files are not part of the standalone trace.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/web/server.js"]
