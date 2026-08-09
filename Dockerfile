FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Dependencies are installed inside Linux so Next.js and optional native
# packages match the Cloud Run runtime platform.
COPY package.json ./
RUN npm install

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# The build needs devDependencies (TypeScript, the ESLint config, the Next
# plugin); the runtime does not. Drop them so test-only packages such as
# @playwright/test never reach the deployed image.
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

EXPOSE 8080
CMD ["npm", "run", "start"]
