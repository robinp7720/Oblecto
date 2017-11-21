const config = require('./config.json');

const restify = require('restify'),
    request = require("request"),
    async = require('async'),
    TVDB = require('node-tvdb'),
    Sequelize = require('sequelize'),
    fs = require('fs'),
    corsMiddleware = require('restify-cors-middleware');

const Op = Sequelize.Op;

const tvdb = new TVDB(config.tvdb.key);
const TvIndexer = require('./bin/indexers/tv');

const sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, {
    host: config.mysql.host,
    dialect: 'mysql',

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    },

});

// Import models for sequelize
const tvshow = sequelize.import(__dirname + "/models/tvshow.js");
const episode = sequelize.import(__dirname + "/models/episode.js");
const user = sequelize.import(__dirname + "/models/user.js");

TVShowIndexer = new TvIndexer(config, tvshow, episode, tvdb);

async.series([
    (callback) => {
        sequelize
            .authenticate()
            .then(callback)
            .catch((err) => {
                console.log(err);
            });

    },
    (callback) => {
        tvshow.sync().then(() => callback());
    },
    (callback) => {
        episode.sync().then(() => callback());
    },
    (callback) => {
        user.sync().then(() => callback());
    },
    (callback) => {
        if (config.indexer.runAtBoot)
            return TVShowIndexer.indexAll(callback);
        return callback();
    }
], (err) => {

});

// Initialize REST based server
const server = restify.createServer();

const requiresAuth = function(req, res, next) {
    if (req.authorization === undefined)
        return next(false);
    user.findOne({where: {access_token: req.authorization.credentials}}).then(user => {
        if (user === null)
            return next(false);
        next();
    })
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


server.use(restify.plugins.bodyParser({ mapParams: true }));

// User interactions
server.post('/auth/login', function (req, res, next) {
    user.findOne({where: {username: req.params.username}}).then(user => {
        require('crypto').randomBytes(48, function(err, buffer) {
            var token = buffer.toString('hex');
            user.set("access_token", token).save();
            res.send(user);
            next();
        });
    })
});

server.get('/auth/isAuthenticated', function (req, res, next) {
    if (req.authorization === undefined)
        res.send([false]);
    user.findOne({where: {access_token: req.authorization.credentials}}).then(user => {
        if (user === null)
            res.send([false]);
        else
            res.send([true]);
        next();
    })
});

// Show retrieval
server.get('/search/:name', requiresAuth, function (req, res, next) {
    tvshow.findAll({
        where: {
            seriesName: {
                [Op.like]: "%" + req.params.name + "%"
            }
        }
    })
        .then((results) => res.send(results));
});

server.get('/shows/recent', requiresAuth, function (req, res, next) {
    tvshow.findAll({
        order: [
            ['createdAt', 'DESC']
        ],
        limit: 30
    })
        .then((results) => res.send(results));
});

server.get('/shows/list/:sorting/:order', requiresAuth, function (req, res, next) {
    tvshow.findAll({
        order: [
            [req.params.sorting, req.params.order]
        ],
        limit: 30
    })
        .then((results) => res.send(results));
});

server.get('/series/:id/info', requiresAuth, function (req, res, next) {
    // search for attributes
    tvshow.findOne({where: {tvdbid: req.params.id}}).then(show => {
        show.genre = JSON.parse(show.genre);
        res.send(show)
    })
});

server.get('/series/:id/episodes', requiresAuth, function (req, res, next) {
    // search for attributes
    episode.findAll({
        where: {showid: req.params.id},
        order: [
            ['airedSeason', 'ASC'],
            ['airedEpisodeNumber', 'ASC']
        ],
    }).then(show => {
        res.send(show)
    })
});

server.get('/series/:name/poster', function (req, res, next) {
    fs.exists('cache/poster/' + req.params.name + '.png', function (exists) {
        if (exists) {
            fs.createReadStream('cache/poster/' + req.params.name + '.png').pipe(res)
        } else {
            tvdb.getSeriesPosters(req.params.name)
                .then(function (data) {
                    console.log("Downloading poster image for", req.params.name, "http://thetvdb.com/banners/" + data[0].fileName);
                    request.get({
                        uri: "http://thetvdb.com/banners/" + data[0].fileName,
                        encoding: null
                    }, function (err, response, body) {
                        fs.writeFile('cache/poster/' + req.params.name + '.png', body, function (error) {
                            if (!error)
                                console.log("Poster downloaded for", req.params.name);
                        });
                        res.contentType = 'image/png';
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


server.get('/episode/:name/image.png', function (req, res, next) {
    fs.exists('cache/episodes/' + req.params.name + '.png', function (exists) {
        if (exists) {
            fs.createReadStream('cache/episodes/' + req.params.name + '.png').pipe(res)
        } else {
            tvdb.getEpisodeById(req.params.name)
                .then(function (data) {
                    request.get({
                        uri: "https://thetvdb.com/banners/_cache/" + data.filename,
                        encoding: null
                    }, function (err, response, body) {
                        fs.writeFile('cache/episodes/' + req.params.name + '.png', body, function (error) {
                            if (!error)
                                console.log("Image downloaded for", req.params.name);
                        });
                        res.contentType = 'image/png';
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

server.get('/episode/:id/play', function (req, res, next) {
    // search for attributes
    episode.findOne({
        where: {tvdbid: req.params.id},
    }).then(episode => {
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
    episode.findOne({
        where: {tvdbid: req.params.id},
    }).then(episode => {
        res.send(episode);
    })
});

server.get('/episode/:id/next', requiresAuth, function (req, res, next) {
    // search for attributes
    episode.findOne({
        where: {tvdbid: req.params.id},
    }).then(results => {
        episode.findOne({
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

server.listen(config.server.port, function () {
    console.log('%s listening at %s', server.name, server.url);
});