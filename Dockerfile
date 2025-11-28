# Use Alpine Linux with Node.js LTS
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy .npmrc for authentication
COPY .npmrc ./

# Copy source code
COPY . .

# Install all dependencies (including dev dependencies for build)
RUN npm i

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S cuvera -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

COPY .npmrc /app/.npmrc

# Install dependencies
RUN npm i

# Copy built application from builder stage
COPY --from=builder --chown=cuvera:nodejs /app/dist ./dist

# # Copy any public assets if they exist
# COPY --chown=cuvera:nodejs public ./public 2>/dev/null || true

# Switch to non-root user
USER cuvera

# Expose port
EXPOSE 7011

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7011/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Start the application
CMD ["node", "dist/app.js"]