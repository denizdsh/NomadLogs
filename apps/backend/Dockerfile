# --- Stage 1: Build & Compile TypeScript ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root lock files and workspace definitions
COPY package*.json ./
COPY packages/db/package*.json ./packages/db/
COPY apps/backend/package*.json ./apps/backend/

# Install dependencies (including devDependencies for compiling)
RUN npm ci

# Copy source code
COPY packages/db ./packages/db
COPY apps/backend ./apps/backend

# Generate Prisma Client & compile typescript
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=@nomadlogs/backend

# --- Stage 2: Runner Stage ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package descriptors for production install
COPY package*.json ./
COPY packages/db/package*.json ./packages/db/
COPY apps/backend/package*.json ./apps/backend/

# Install only production dependencies
RUN npm ci --only=production

# Copy generated Prisma client, database package compiled source, and backend compiled code
COPY --from=builder /app/packages/db/generated ./packages/db/generated
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Expose port and run as non-root user
EXPOSE 4000
USER node

CMD ["node", "apps/backend/dist/index.js"]
