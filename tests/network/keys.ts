import defaults from '../../res/config.json';

// The project's own keys ship in res/config.json; the environment can point a run at other ones.
export const TVDB_KEY = process.env.OBLECTO_TVDB_KEY || defaults.tvdb.key;
export const TMDB_KEY = process.env.OBLECTO_TMDB_KEY || defaults.themoviedb.key;
export const FANART_KEY = process.env.OBLECTO_FANART_KEY || defaults['fanart.tv'].key;
