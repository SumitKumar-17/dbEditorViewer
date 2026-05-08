# Build context must be the repo root (docker-compose.yml sets context: .)
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.18.3

# Copy workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY frontend/package.json ./frontend/

# Install all frontend deps
RUN pnpm install --frozen-lockfile

# Copy source after deps (so source changes don't bust the install cache)
COPY frontend/ ./frontend/

# Explicitly add workspace bin dir to PATH — Alpine sh doesn't get pnpm's
# automatic PATH injection, so vite/tsc would be "not found" without this
ENV PATH="/app/node_modules/.bin:${PATH}"

WORKDIR /app/frontend
RUN pnpm build

# ── Production image ───────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
