import databases from '../../submodules/database';


export default class MovieCleaner {
    /**
     * @param {Oblecto} oblecto
     */
    constructor(oblecto) {
        this.oblecto = oblecto;
    }

    async removeFileLessMovies() {
        console.log('Removing movies with no linked files');

        let results = await databases.movie.findAll({
            include: [databases.file]
        });

        for (let item of results) {
            if (item.files && item.files.length > 0)
                continue;

            console.log(`Removing ${item.movieName}`);

            await item.destroy();
        }
    }
}
