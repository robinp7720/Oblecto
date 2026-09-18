# Build: both web frontends and the server bundle, then drop development dependencies.
FROM node:24 AS build
WORKDIR /build
COPY . .
RUN npm ci && npm run build && npm prune --omit=dev

# Run: Node, ffmpeg for playback and guessit for identification, nothing from the build.
FROM node:24-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg python3-guessit tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/oblecto
COPY --from=build /build/package.json /build/package-lock.json ./
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/dist ./dist
COPY --from=build /build/res ./res
COPY --from=build /build/images ./images
COPY --from=build /build/Oblecto-Web/dist ./Oblecto-Web/dist
COPY docker/entrypoint.sh /usr/local/bin/oblecto-entrypoint

# Configuration, the SQLite database, artwork and logs all live in this volume.
RUN mkdir -p /etc/oblecto && chown node:node /etc/oblecto
VOLUME /etc/oblecto
ENV OBLECTO_CONFIG_PATH=/etc/oblecto/config.json

USER node

# Web UI and REST API, then the Jellyfin-compatible API. Federation uses 9131 and 9132 when enabled.
EXPOSE 8080 8096

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
    CMD node -e "fetch('http://127.0.0.1:8080/auth/login-options').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["tini", "--", "oblecto-entrypoint"]
CMD ["start"]
