FROM node:10
WORKDIR /build
RUN apt update
RUN apt install ffmpeg libavahi-compat-libdnssd-dev python3-pip -y
RUN pip3 install guessit
COPY package*.json ./
RUN npm install
RUN npm i sqlite3
COPY . .
RUN npm run prepare
RUN mkdir /etc/oblecto
EXPOSE 8080 9131 9132
CMD [ "node", "dist/bin/oblecto", "start" ]
