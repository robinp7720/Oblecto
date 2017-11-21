# Oblecto
## What is it?
Oblecto is a media server, similar to Plex, Emby, Netflix and others. It runs in the background on a home server to index your media such as movies and TV shows to make them searchable and streamable through a REST based interface.

## How do I use this?
Currently Oblecto is very much still in a WIP status. It currently only indexes TV shows and doesn't have a method of changing settings on the fly.

## How do I set this up?
Simple!

Edit config.json to suit your needs. Please pay attention to the mysql database config as Oblecto uses a MySQL database to store its data.

```bash
npm install
node .
```

On run, Oblecto will create its database if requireded and start indexing files as defined in the config.json file.
User accounts must currently be created manually in the database.