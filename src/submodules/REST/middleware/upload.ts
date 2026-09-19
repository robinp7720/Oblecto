import os from 'os';
import fileUpload from 'express-fileupload';

// Artwork and avatars are well under this; anything larger is refused before it is written out.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * Multipart parsing for the routes that take an image. Mounted after each route's permission
 * check, so an unauthenticated request never gets a temporary file written for it.
 */
export default fileUpload({
    useTempFiles: true,
    tempFileDir: os.tmpdir(),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    abortOnLimit: true,
    responseOnLimit: JSON.stringify({ message: 'The image is larger than 25 MB' }),
    safeFileNames: true,
    preserveExtension: false
});
