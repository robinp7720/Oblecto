import path from 'path';
import fs from 'fs';
import databases from '../../../submodules/database';
import queue from '../../../submodules/queue';
import tmdb from '../../../submodules/tmdb';
import UserManager from '../../../submodules/users';
import config from '../../../config.js';
import guessit from '../../../submodules/guessit';
import ffprobe from '../../../submodules/ffprobe';

// TODO: Add config option to use the parent directory to identify movies

async function identifyByName(name) {
    // If the year is present at the end of the name, remove it for the search
    // TODO: Using a regex mach, retrieve the year and use it in the search processes
    name = name.replace(/ \([0-9][0-9][0-9][0-9]\)/g, '');

    return await tmdb.searchMovie({ query: name });
}

async function identifyByGuess (basename) {
    var identification = await guessit.identify(basename);

    let query = {query: identification.title};

    if (identification.year) {
        query.year = identification.year;
    }

    return await tmdb.searchMovie(query);
}

export default async function (moviePath) {

    let metadata = await ffprobe(moviePath);

    // Create file entity in the database
    let [file, FileInserted] = await databases.file.findOrCreate({
        where: {path: moviePath},
        defaults: {
            name: path.parse(moviePath).name,
            directory: path.parse(moviePath).dir,
            extension: path.parse(moviePath).ext.replace('.', '').toLowerCase(),

            duration: metadata.format.duration
        }
    });

    if (FileInserted) {
        console.log('File inserted:', moviePath);
    } else {
        console.log('File already in database:', moviePath);
    }

    let res = await identifyByGuess(path.basename(moviePath));


    if (!res || res.total_results < 1) {
        console.log('Could not identify', moviePath, 'using guessit');
        console.log('Attempting to identify', moviePath, 'using only the file name');


        res = await identifyByName(path.basename(path.parse(moviePath).name));
    }

    if (!res || res.total_results < 1) {
        console.log('Could not identify', moviePath, 'by file name');
        console.log('Attempting to identify', moviePath, 'by containing folder');


        res = await identifyByName(path.basename(path.parse(moviePath).dir));
    }

    if (!res || res.total_results < 1) {
        console.log('Could not identify', moviePath);
        return false;
    }


    let data = res.results[0];

    let [movie, MovieInserted] = await databases.movie
        .findOrCreate({
            where: {tmdbid: data.id}, defaults: {
                movieName: data.title,
                popularity: data.popularity,
                releaseDate: data.release_date,
                overview: data.overview,
                file: moviePath
            }
        });

    if (MovieInserted) {
        console.log(movie.movieName, 'added to database');

        // Inform all connected clients that a new movie has been imported
        UserManager.sendToAll('indexer', {event: 'added', type: 'movie'});
    } else {
        console.log(movie.movieName, 'was already in the database');
    }

    movie.addFile(file);

    if (config.transcoding[file.extension] !== undefined && config.transcoding[file.extension] !== false) {
        queue.push({task: 'transcode', path: moviePath}, async function (err) {
            // Determine the file path of the transcoded file
            let parsed = path.parse(moviePath);
            let extension = parsed.ext.replace('.', '').toLowerCase();
            let transcodedPath = moviePath.replace(parsed.ext, '.' + config.transcoding[extension]);

            // Insert the new file and link it to the movie entity
            let [file, FileInserted] = await databases.file.findOrCreate({
                where: {path: transcodedPath},
                defaults: {
                    name: path.parse(transcodedPath).name,
                    directory: path.parse(transcodedPath).dir,
                    extension: path.parse(transcodedPath).ext.replace('.', '').toLowerCase()
                }
            });


            movie.addFile(file).then(() => {
                movie.save();
            });
        });
    }

    return true;
}