const config = require('./config.json');

const socketio = require("socket.io");

const restify = require('restify'),
    request = require("request"),
    async = require('async'),
    TVDB = require('node-tvdb'),
    Sequelize = require('sequelize'),
    fs = require('fs'),
    corsMiddleware = require('restify-cors-middleware'),
    path = require('path');

const databases = require('./submodules/database');

const Op = Sequelize.Op;

const tvdb = new TVDB(config.tvdb.key);
const TvIndexer = require('./bin/indexers/tv');

const jwt = require('jsonwebtoken');

// Load Oblecto submodules
const zeroconf = require('./submodules/zeroconf');
zeroconf.start(config.server.port);
const UserManager = require('./submodules/users');

TVShowIndexer = new TvIndexer(config, databases.tvshow, databases.episode, tvdb);

if (config.indexer.runAtBoot)
    TVShowIndexer.indexAll(() => {
        console.log("Initial index complete");
    });

// Initialize REST based server
const server = restify.createServer();

const requiresAuth = function (req, res, next) {
    if (req.authorization === undefined)
        return next(false);

    jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
        if (err)
            return next(false);
        next();
    });
};

// Allow remote clients to connect to the backend
const cors = corsMiddleware({
    preflightMaxAge: 5, //Optional
    origins: ['*'],
    allowHeaders: ['API-Token', 'authorization'],
    exposeHeaders: ['API-Token-Expiry']
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.authorizationParser());
server.use(restify.plugins.bodyParser({mapParams: true}));

server.use(function (req, res, next) {
    if (req.authorization === undefined)
        return next();

    jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
        if (err)
            return next();
        req.authorization.jwt = decoded;

        // Add user if user isn't already loaded into memory
        UserManager.userAdd(decoded);

        next();
    });
});

// User interactions
server.post('/auth/login', function (req, res, next) {
    // TODO: Implement password hashing
    databases.user.findOne({where: {username: req.params.username}, attributes: ['username', 'name', 'email', 'id']}).then(user => {
        let token = jwt.sign(user.toJSON(), config.authentication.secret);
        user['access_token'] = token;
        res.send(user);
        next();
    })
});

server.get('/auth/isAuthenticated', function (req, res, next) {
    if (req.authorization === undefined)
        return res.send([false]);

    jwt.verify(req.authorization.credentials, config.authentication.secret, function (err, decoded) {
        if (err)
            res.send([false]);
        else
            res.send([true]);
        next();
    });
});

// Maintenance tasks
server.get('/maintenance/reindex', requiresAuth, function (req, res, next) {
    res.send([true]);
    TVShowIndexer.indexAll(() => {

    });
});

// Show retrieval
server.get('/search/:name', requiresAuth, function (req, res, next) {
    databases.tvshow.findAll({
        where: {
            seriesName: {
                [Op.like]: "%" + req.params.name + "%"
            }
        }
    })
        .then((results) => res.send(results));
});

server.get('/shows/list/:sorting/:order', requiresAuth, function (req, res, next) {
    databases.tvshow.findAll({
        order: [
            [req.params.sorting, req.params.order]
        ],
        limit: 30
    })
        .then((results) => res.send(results));
});

server.get('/episodes/list/:sorting/:order', requiresAuth, function (req, res, next) {
    databases.episode.findAll({
        include: [databases.tvshow],
        order: [
            [req.params.sorting, req.params.order]
        ],
        limit: 30
    })
        .then((results) => res.send(results));
});

server.get('/series/:id/info', requiresAuth, function (req, res, next) {
    // search for attributes
    databases.tvshow.findById(req.params.id).then(show => {
        show.genre = JSON.parse(show.genre);
        res.send(show)
    })
});

server.get('/series/:id/index', requiresAuth, function (req, res, next) {
    databases.tvshow.findById(req.params.id).then(show => {
        TVShowIndexer.indexShow(show.directory, () => {

        });

        res.send([true])
    })
});

server.get('/series/:id/episodes', requiresAuth, function (req, res, next) {
    // search for attributes
    databases.episode.findAll({
        include: [databases.tvshow],
        where: {tvshowId: req.params.id},
        order: [
            ['airedSeason', 'ASC'],
            ['airedEpisodeNumber', 'ASC']
        ],
    }).then(show => {
        res.send(show)
    })
});

server.get('/series/:id/poster', function (req, res, next) {
    databases.tvshow.findById(req.params.id).then(show => {
        let showPath = show.directory;
        let posterPath = path.join(showPath, show.seriesName + '-poster.jpg');

        // Check if the poster image already exits
        fs.exists(posterPath, function (exists) {
            if (exists) {
                // If the image exits, simply pipe it to the client
                fs.createReadStream(posterPath).pipe(res)
            } else {
                // If it doesn't exist, download a new one and snd it to the client
                tvdb.getSeriesPosters(show.tvdbid)
                    .then(function (data) {
                        console.log("Downloading poster image for", show.seriesName, "http://thetvdb.com/banners/" + data[0].fileName);
                        request.get({
                            uri: "http://thetvdb.com/banners/" + data[0].fileName,
                            encoding: null
                        }, function (err, response, body) {
                            fs.writeFile(posterPath, body, function (error) {
                                if (!error)
                                    console.log("Poster downloaded for", show.seriesName);
                            });
                            res.contentType = 'image/jpeg';
                            res.send(body);
                            next()
                        })
                    })
                    .catch(function (error) {
                        res.send("");
                        next();
                    })
            }
        });
    });
});


server.get('/episode/:id/image.png', function (req, res, next) {
    // Get episode data
    databases.episode.findById(req.params.id).then(episode => {
        let episodePath = episode.file;

        // Set the thumbnail to have the same name but with -thumb.jpg instead of the video file extension
        let thumbnailPath = episodePath.replace(path.extname(episodePath), "-thumb.jpg");

        // Check if the thumbnail exists
        fs.exists(thumbnailPath, function (exists) {
            if (exists) {
                // If the thumbnail exists, simply pipe that to the client
                fs.createReadStream(thumbnailPath).pipe(res)
            } else {
                // If no thumbnail was found, download one from thetvdb
                tvdb.getEpisodeById(episode.tvdbid)
                    .then(function (data) {
                        request.get({
                            uri: "https://thetvdb.com/banners/_cache/" + data.filename,
                            encoding: null
                        }, function (err, response, body) {
                            fs.writeFile(thumbnailPath, body, function (error) {
                                if (!error)
                                    console.log("Image downloaded for", episode.episodeName);
                            });
                            res.contentType = 'image/jpeg';
                            res.send(body);
                            next()
                        })
                    })
                    .catch(function (error) {
                        res.send(error);
                        next();
                    })
            }
        });
    });

});

server.get('/episode/:id/play', function (req, res, next) {
    // search for attributes
    databases.episode.findById(req.params.id).then(episode => {
        let path = episode.file;
        var stat = fs.statSync(path);
        var total = stat.size;

        if (req.headers.range) {   // meaning client (browser) has moved the forward/back slider
            // which has sent this request back to this server logic ... cool
            var range = req.headers.range;
            var parts = range.replace(/bytes=/, "").split("-");
            var partialstart = parts[0];
            var partialend = parts[1];

            var start = parseInt(partialstart, 10);
            var end = partialend ? parseInt(partialend, 10) : total - 1;
            var chunksize = (end - start) + 1;
            console.log('RANGE: ' + start + ' - ' + end + ' = ' + chunksize);

            var file = fs.createReadStream(path, {start: start, end: end});
            res.writeHead(206, {
                'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4'
            });
            file.pipe(res);

        } else {

            console.log('ALL: ' + total);
            res.writeHead(200, {'Content-Length': total, 'Content-Type': 'video/mp4'});
            fs.createReadStream(path).pipe(res);
        }
    })
});

server.get('/episode/:id/info', requiresAuth, function (req, res, next) {
    // search for attributes
    databases.episode.findById(req.params.id).then(episode => {
        episode = episode.toJSON();

        if (UserManager.hasSavedProgress(req.authorization.jwt.username, episode.id))
            episode.watchTime = UserManager.getSavedProgress(req.authorization.jwt.username, episode.id).time;

        res.send(episode);
    })
});

server.get('/episode/:id/next', requiresAuth, function (req, res, next) {
    // search for attributes
    databases.episode.findById(req.params.id).then(results => {
        databases.episode.findOne({
            where: {
                showid: results.showid,
                [Op.or]: [
                    {
                        [Op.and]: [
                            {airedEpisodeNumber: {[Op.gt]: results.airedEpisodeNumber}},
                            {airedSeason: {[Op.gte]: results.airedSeason}},
                        ]
                    },
                    {
                        [Op.and]: [
                            {airedSeason: {[Op.gt]: results.airedSeason}},
                        ]
                    }
                ]
            },
            order: [
                ['airedSeason', 'ASC'],
                ['airedEpisodeNumber', 'ASC'],
            ]
        }).then(episode => {
            res.send(episode);
        })
    })
});


server.get('/watching', requiresAuth, function (req, res, next) {
    // search for attributes
    databases.track.findAll({
        include: [
            {
                model: databases.episode,
                include: [databases.tvshow]
            }
        ],
        where: {
            userId: req.authorization.jwt.id,
            progress: {[Op.lt]: 0.9}
        },
        order: [
            ['updatedAt', 'DESC'],
        ],
    }).then(episodes => {
        res.send(episodes.map((episode)=> {
            return episode.episode.toJSON();
        }))
    })
});

// Socket connection
let io = socketio.listen(server.server, {
    log: false,
    agent: false,
    origins: '*:*',
    transports: ['websocket', 'polling']
});

io.on('connection', UserManager.userConnected);

// Start restify server
server.listen(config.server.port, function () {
    console.log('%s listening at %s', server.name, server.url);
});


// Periodically save the user storage to the database
setInterval(() => {
    UserManager.saveAllUserProgress(() => {
        console.log('User progress save');
    })
}, 2000);


