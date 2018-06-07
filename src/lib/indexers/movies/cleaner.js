import databases from '../../../submodules/database';

export default {
    async removeFileLessMovies() {
        let results = await databases.movie.findAll({
            include: [databases.file]
        });

        results.forEach((item) => {
            if (item.files && item.files.length > 0)
                return false;

            item.destroy();
        });

    }
};