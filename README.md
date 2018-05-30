# Oblecto
## What is it?
Oblecto is a media server, similar to Plex, Emby, Netflix and others. It runs in the background on a home server to index your media such as movies and TV shows to make them searchable and streamable through a REST based interface.

## How do I use this?
While Oblecto is still a work in progress project, Oblecto does currently support movie and TV streaming. It tracks episodes which have been watched and allows you to stop watching on one device and pickup right where you left off on another.

## How do I set this up?
Simple!

Edit config.json to suit your needs. Please pay attention to the mysql database config as Oblecto uses a MySQL database to store its data.

```bash
npm install
npm start
```

On run, Oblecto will create its database if required and start indexing files as defined in the config.json file.
User accounts must currently be created manually in the database.