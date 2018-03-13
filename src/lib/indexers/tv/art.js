import databases from "../../../submodules/database";
import tvdb from "../../../submodules/tvdb";
import queue from "../../../submodules/queue";
import path from "path";
import fs from "fs";
import request from "request"

export default {
    async DownloadEpisodeBanner(id) {
        let episode = await databases.episode.findById(id, {include: [databases.file]});

        let episodePath = episode.files[0].path;

        console.log("Checking thumnail for", episodePath);

        // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
        let thumbnailPath = episodePath.replace(path.extname(episodePath), "-thumb.jpg");


        try {
            let stat = fs.statSync(thumbnailPath);

            console.log("Thumnail exists for", episodePath);
        } catch (e) {
            // If no thumbnail was found, download one from thetvdb
            let data = await tvdb.getEpisodeById(episode.tvdbid);

            request.get({
                uri: "https://thetvdb.com/banners/_cache/" + data.filename,
                encoding: null
            }, function (err, response, body) {
                fs.writeFile(thumbnailPath, body, function (error) {
                    if (error) {
                        console.error("An error has occured when downloading banner for", episodePath);
                    }

                    console.log("Image downloaded for", episodePath);
                });
            })
        }
    },

    async DownloadSeriesPoster(id) {
        let show = await databases.tvshow.findById(id);

        let showPath = show.directory;
        let posterPath = path.join(showPath, show.seriesName + '-poster.jpg');

        // Check if the poster image already exits
        let exists = fs.existsSync(posterPath);

        // Only download the poster if it doesn't exist
        if (!exists) {
            let data = await tvdb.getSeriesPosters(show.tvdbid);

            console.log("Downloading poster image for", show.seriesName, "http://thetvdb.com/banners/" + data[0].fileName);
            request.get({
                uri: "http://thetvdb.com/banners/" + data[0].fileName,
                encoding: null
            }, function (err, response, body) {
                fs.writeFile(posterPath, body, function (error) {
                    if (!error)
                        console.log("Poster downloaded for", show.seriesName);
                });
            })
        }
    },

    /**
     * @return {boolean}
     */
    async DownloadAllEpisodeBanners() {
        let Episodes = databases.episode.findAll();

        Episodes.each((Episode) => {
            queue.push({task: "DownloadEpisodeBanner", id: Episode.id}, function (err) {

            });
        });

        return true;
    },

    /**
     * @return {boolean}
     */
    async DownloadAllSeriesPosters() {
        let Shows = databases.tvshow.findAll();

        Shows.each((Show) => {
            queue.push({task: "DownloadSeriesPoster", id: Show.id}, function (err) {

            });
        });

        return true;
    },

    async DownloadAll() {
        await this.DownloadAllEpisodeBanners();
        await this.DownloadAllSeriesPosters();
    }
}