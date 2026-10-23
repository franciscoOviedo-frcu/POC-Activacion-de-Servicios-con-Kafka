FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
RUN npm ci
COPY libs/ libs/
COPY apps/notification-service/ apps/notification-service/
RUN npx nest build notification-service

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
CMD ["node", "dist/apps/notification-service/apps/notification-service/src/main.js"]
