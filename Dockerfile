# syntax=docker/dockerfile:1

# One image for the whole game: nginx serves the web app and proxies /api and
# /health to the game API, which runs next to it in the same container.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS web-build
WORKDIR /src
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY services/game-api/package.json services/game-api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci
COPY tsconfig.base.json ./
COPY apps/web apps/web
# VITE_API_URL stays unset: the browser calls /api on the address it was served from.
RUN npm run build -w @bdi/web

FROM node:${NODE_VERSION}-alpine AS api-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/domain/package.json packages/domain/
COPY services/game-api/package.json services/game-api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --workspace @bdi/game-api

FROM node:${NODE_VERSION}-alpine AS runtime
RUN apk add --no-cache nginx tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-deps /app ./
COPY packages/domain packages/domain
COPY services/game-api services/game-api
COPY --from=web-build /src/apps/web/dist /usr/share/nginx/html
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --chmod=755 deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
# The API keeps its event log (and the session file when DATABASE_URL is unset) here.
RUN mkdir -p services/game-api/data && chown node:node services/game-api/data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
