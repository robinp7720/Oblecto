import databases from '../../submodules/database';

export default class SeriesCleaner {
    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async removeFileLessEpisodes() {
        console.log('Removing episodes with no linked files');

        let results = await databases.episode.findAll({
            include: [databases.file]
        });

        for (let item of results) {
            if (item.files && item.files.length > 0)
                continue;

            console.log(`Removing ${item.episodeName}`);

            await item.destroy();
        }
    }

    async removePathLessShows() {
        await databases.tvshow.destroy({
            where: {
                directory: ''
            }
        });
    }

    async removeEpisodeslessShows() {
        console.log('Removing Shows without episodes');

        let results = await databases.tvshow.findAll({
            include: [databases.episode]
        });

        for (let item of results) {
            if (item.episodes && item.episodes.length > 0)
                continue;

            await item.destroy();
        }
    }
}
