FROM node:24
WORKDIR /build
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libavahi-compat-libdnssd-dev python3 python3-guessit \
    && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci && npm run build
RUN mkdir /etc/oblecto
EXPOSE 8080 9131 9132
CMD [ "node", "dist/bin/oblecto.js", "start" ]
