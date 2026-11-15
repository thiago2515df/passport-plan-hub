FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN npm install -g bun@1.2.22 && bun install --frozen-lockfile

COPY . .
ENV NITRO_PRESET=node_server
RUN bun run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
