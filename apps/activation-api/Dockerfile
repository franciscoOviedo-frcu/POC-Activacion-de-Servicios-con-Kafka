FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
RUN npm ci
COPY libs/ libs/
COPY apps/activation-api/ apps/activation-api/
RUN npx nest build activation-api

FROM node:20-alpine AS runner
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/apps/activation-api/apps/activation-api/src/main.js"]
