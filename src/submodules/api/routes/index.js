import auth from './auth'
import episodes from './episodes'
import files from './files'
import movies from './movies'
import tvshows from './tvshows'

export default (server) => {
    auth(server);
    episodes(server);
    files(server);
    movies(server);
    tvshows(server)
}