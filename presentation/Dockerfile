FROM node:24.16.0-alpine3.22 AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY slides.md style.css ./
COPY public ./public
RUN pnpm build

FROM nginx:1.27.5-alpine3.21

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN touch /run/nginx.pid \
    && chown -R nginx:nginx /etc/nginx/conf.d /var/cache/nginx /run/nginx.pid

USER nginx
EXPOSE 4177
