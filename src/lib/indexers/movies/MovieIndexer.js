import path from 'path';
import databases from '../../../submodules/database';
import queue from '../../../submodules/queue';
import UserManager from '../../../submodules/users';
import config from '../../../config.js';
import ffprobe from '../../../submodules/ffprobe';

import MovieSetCollector from './MovieSetCollector';
import MovieArtworkRetriever from './MovieArtworkRetriever';
import MovieIdentifier from './MovieIdentifier';
import FileIndexer from '../files/FileIndexer';
import FileExistsError from '../../errors/FileExistsError';
import VideoAnalysisError from '../../errors/VideoAnalysisError';

export default async function (moviePath, reIndex) {
    let file;

    try {
        file = await FileIndexer.indexVideoFile(moviePath);
    } catch (e) {
        if (e instanceof FileExistsError) {
            if (!reIndex) return false;
        } else if (e instanceof VideoAnalysisError) {
            console.log(`Error analysing ${moviePath}`);
            return false;
        } else {
            throw e;
        }
    }

    let data = await MovieIdentifier.identifyMovie(moviePath);

    let [movie, MovieInserted] = await databases.movie
        .findOrCreate({
            where: {tmdbid: data.tmdbId}, defaults: {
                movieName: data.title,
                popularity: data.tmdb.popularity,
                releaseDate: data.releaseDate,
                overview: data.overview,
                file: moviePath
            }
        });

    movie.addFile(file);

    await MovieArtworkRetriever.QueueMoviePoster(movie);
    await MovieArtworkRetriever.QueueMovieFanart(movie);

    MovieSetCollector.GetSetsForMovie(movie);


    if (MovieInserted) {
        console.log(movie.movieName, 'added to database');

        // Inform all connected clients that a new movie has been imported
        UserManager.sendToAll('indexer', {event: 'added', type: 'movie'});
    } else {
        console.log(movie.movieName, 'was already in the database');
    }

    if (config.transcoding[file.extension] !== undefined && config.transcoding[file.extension] !== false) {
        queue.push({task: 'transcode', path: moviePath}, async function (err) {
            // Determine the file path of the transcoded file
            let file;

            try {
                file = await FileIndexer.indexVideoFile(moviePath);
            } catch (e) {
                if (e instanceof FileExistsError) {
                    if (!reIndex) return false;
                } else if (e instanceof VideoAnalysisError) {
                    console.log(`Error analysing ${moviePath}`);
                    return false;
                } else {
                    throw e;
                }
            }

            movie.addFile(file).then(() => {
                movie.save();
            });
        });
    }

    return true;
}
