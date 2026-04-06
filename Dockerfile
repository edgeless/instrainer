# Build stage
FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Run stage
FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/package.json ./
# adapter-node produces a 'build' folder that is a standalone node app
# but we still need production dependencies if they aren't bundled.
# Usually adapter-node requires 'polka' or similar if not provided.
RUN npm install --omit=dev
COPY --from=builder /app/build ./build

ENV PORT=8080
ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "build"]
