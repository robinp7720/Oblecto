import path from "path";
import fs from "fs";
import databases from "../../../submodules/database";
import queue from "../../../submodules/queue";
import tmdb from "../../../submodules/tmdb";

// TODO: Add config option to use the parent directory to identify movies

export default async function (moviePath) {

        // Create file entity in the database
        let [file, FileInserted] = await databases.file.findOrCreate({
            where: {path: moviePath},
            defaults: {
                name: path.parse(moviePath).name,
                directory: path.parse(moviePath).dir,
                extension: path.parse(moviePath).ext
            }
        });

        if (FileInserted) {
            console.log("File inserted:", moviePath);
        } else {
            console.log("File already in database:", moviePath);
            return false;
        }


        let name = path.parse(moviePath).name;

        // If the year is present at the end of the name, remove it for the search
        // TODO: Using a regex mach, retrieve the year and use it in the search processes
        name = name.replace(/ \([0-9][0-9][0-9][0-9]\)/g, '');

        let res = await tmdb.searchMovie({ query: name });

        // Return if no matching movie was found
        if (res.total_results < 1) {
            console.log("Could not identify", moviePath);
            return false;
        }

        let data = res.results[0];

        // Download assets for movie such as banners and posters and store them along side the movie files
        let posterPath = moviePath.replace(path.extname(moviePath), "-poster.jpg");
        let fanartPath = moviePath.replace(path.extname(moviePath), "-fanart.jpg");

        fs.exists(posterPath, function (exists) {
            if (!exists) {
                queue.push({
                    task: "download",
                    path: posterPath,
                    url: "https://image.tmdb.org/t/p/w500" + data.poster_path
                }, 20);

            }
        });

        fs.exists(fanartPath, function (exists) {
            if (!exists) {
                queue.push({
                    task: "download",
                    path: fanartPath,
                    url: "https://image.tmdb.org/t/p/w500" + data.backdrop_path
                }, 20);
            }
        });

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
        } else {
            console.log(movie.movieName, 'was already in the database');
        }

        movie.addFile(file);

        return true;
    }