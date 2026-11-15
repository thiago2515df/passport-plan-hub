FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json bun.lock ./
RUN npm install -g bun@1.2.22 && bun install

COPY . .

ARG VITE_SUPABASE_PROJECT_ID=qsezhcorqurhtxfhcqxq
ARG VITE_SUPABASE_URL=https://qsezhcorqurhtxfhcqxq.supabase.co
ARG VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_9kMVbg91qFyxThvvnp4KGQ_kx6ORpL7

ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
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
