import fs from 'fs';

export default class imageManager {
    static async imageExists(imagePath) {
        let stat;

        try {
            stat = fs.statSync(imagePath);
        } catch (e) {
            return false;
        }

        // Re-download thumbnail if it's to small in size
        // This may mean that the thumbnail image is corrupt or wasn't downloaded properly the first time.
        // TODO: Complete a proper integrity check on the image file
        if (stat.size < 1000) {
            fs.unlink(imagePath, () => {
                console.log(`${imagePath} exit but the file seams to small to be an actual file`);
            });
        }

        return true;
    }

    static async save(path, body) {
        return new Promise(function (fulfill, reject) {
            fs.writeFile(path, body, function (error) {
                if (error) {
                    reject(error);
                }

                fulfill();
            });
        });
    }
}
