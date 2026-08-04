FROM node:24.16.0-alpine3.22

RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --chown=app:app package.json server.mjs ./

USER app
EXPOSE 4173
CMD ["node", "server.mjs"]
