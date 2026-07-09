# ═══════════════════════════════════════════
# Hanjeli SmartFarm — Backend Dockerfile
#
# Multi-stage build for production:
#   Stage 1 (deps)  : Install dependencies
#   Stage 2 (build) : Compile TypeScript
#   Stage 3 (prod)  : Lightweight runtime image
#
# Hasil akhir: image ~180MB (vs ~1GB tanpa multi-stage)
# ═══════════════════════════════════════════

# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps

WORKDIR /app

# Copy hanya file yang dibutuhkan untuk install
COPY package.json package-lock.json ./

# Install semua dependencies (termasuk devDependencies untuk build)
RUN npm ci --ignore-scripts

# ── Stage 2: Build TypeScript ──
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build NestJS (TypeScript → JavaScript)
RUN npm run build

# Hapus devDependencies setelah build selesai
RUN npm prune --production

# ── Stage 3: Production runtime ──
FROM node:22-alpine AS production

WORKDIR /app

# Metadata label
LABEL maintainer="Hanif Miftahulhuda"
LABEL description="Hanjeli SmartFarm Backend API"

# Buat user non-root untuk keamanan
RUN addgroup -g 1001 -S hanjeli && \
    adduser -S hanjeli -u 1001

# Copy hasil build dan production dependencies
COPY --from=build --chown=hanjeli:hanjeli /app/dist ./dist
COPY --from=build --chown=hanjeli:hanjeli /app/node_modules ./node_modules
COPY --from=build --chown=hanjeli:hanjeli /app/package.json ./package.json

# Buat folder uploads agar tidak error saat runtime
RUN mkdir -p /app/uploads && chown hanjeli:hanjeli /app/uploads

# Jalankan sebagai user non-root
USER hanjeli

# Expose port backend
EXPOSE 3000

# Healthcheck internal
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const http = require('http'); const req = http.request({hostname:'localhost',port:3000,path:'/api/v3/health',timeout:3000}, res => { process.exit(res.statusCode === 200 ? 0 : 1) }); req.on('error', () => process.exit(1)); req.end();" || exit 1

# Jalankan aplikasi
CMD ["node", "dist/main.js"]
