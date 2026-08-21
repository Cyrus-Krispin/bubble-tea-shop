FROM node:24.16.0-alpine3.22 AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN corepack enable && pnpm install --frozen-lockfile

COPY . ./

ARG VITE_SUPABASE_URL=http://localhost:8000
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL

RUN pnpm build

FROM nginx:1.27.5-alpine3.21

ENV NGINX_ENVSUBST_FILTER=SUPABASE_CONNECT_SRC \
    SUPABASE_CONNECT_SRC=http://localhost:8000

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

RUN touch /run/nginx.pid \
    && chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx /run/nginx.pid

USER nginx
EXPOSE 4173
