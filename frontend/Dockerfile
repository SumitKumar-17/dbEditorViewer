# Build context must be the repo root (set in docker-compose.yml)
# so we can access pnpm-lock.yaml and pnpm-workspace.yaml

FROM node:22-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack (ships with Node 22)
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy workspace manifests first (better layer caching)
COPY pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY frontend/package.json ./frontend/

# Install only frontend deps
RUN pnpm install --frozen-lockfile --filter frontend

# Copy frontend source
COPY frontend/ ./frontend/

# Build Vite app (outputs to frontend/dist)
RUN pnpm --filter frontend build

# ── Production image ───────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
