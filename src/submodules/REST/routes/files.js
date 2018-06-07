import sequelize from 'sequelize';

import databases from '../../../submodules/database';
import authMiddleWare from '../middleware/auth';

export default (server) => {
    // Endpoint to get the files currently being watched
    server.get('/watching', authMiddleWare.requiresAuth, async function (req, res) {
        // search for attributes
        let tracks = await databases.trackEpisodes.findAll({
            include: [{
                model: databases.episode,
                required: true,
                include: [
                    databases.tvshow,
                    {
                        model: databases.trackEpisodes,
                        required: false,
                        where: {
                            userId: req.authorization.jwt.id
                        }
                    }
                ]
            }],
            where: {
                userId: req.authorization.jwt.id,
                progress: {
                    [sequelize.Op.lt]: 0.9
                }
            },
            order: [
                ['updatedAt', 'DESC'],
            ],
        });

        // We are only interested in the episode objects, so extract all the episode object from 
        // each track object and send the final mapped array to the client
        res.send(tracks.map((track) => {
            return track.episode;
        }));
    });
};