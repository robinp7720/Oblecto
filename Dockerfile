FROM node:20
WORKDIR /build
RUN apt update
RUN apt install ffmpeg libavahi-compat-libdnssd-dev python3 python3-guessit -y
COPY . .
RUN npm install --legacy-peer-deps
RUN npm i sqlite3
RUN mkdir /etc/oblecto
EXPOSE 8080 9131 9132
CMD [ "node", "dist/bin/oblecto", "start" ]
