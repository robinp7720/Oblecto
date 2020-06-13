import databases from '../../../submodules/database';

export default {
    async removeFileLessEpisodes() {
        console.log('Removing episodes with no linked files');

        let results;

        try {
            results = await databases.episode.findAll({
                include: [databases.file]
            });
        } catch (e) {
            console.log(e);
        }

        for (let i in results) {
            let item = results[i];

            if (item.files && item.files.length > 0)
                continue;

            console.log(`Removing ${item.episodeName}`);

            try {
                await item.destroy();
            } catch (e) {
                console.log(e);
            }

        }

    },

    async removePathLessShows() {
        let results = await databases.tvshow.destroy({
            where: {
                directory: ''
            }
        });
    },

    async removeEpisodeslessShows() {
        console.log('Removing Shows without episodes');

        let results = await databases.tvshow.findAll({
            include: [databases.episode]
        });

        results.forEach((item) => {
            if (item.episodes && item.episodes.length > 0)
                return false;

            item.destroy();
        });
    }
};
