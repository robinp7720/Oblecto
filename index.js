const config = require('./config.json');

const socketio = require("socket.io");

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

const jwt = require('jsonwebtoken');

// Load Oblecto submodules
const zeroconf = require('./submodules/zeroconf');
zeroconf.start(config.server.port);
const UserManager = require('./submodules/users');


const sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, {
    host: config.mysql.host,
    dialect: 'mysql',
    logging: false,

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

episode.belongsTo(tvshow);

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
    user.findOne({where: {username: req.params.username}, attributes: ['username', 'name', 'email']}).then(user => {
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
    tvshow.findAll({
        where: {
            seriesName: {
                [Op.like]: "%" + req.params.name + "%"
            }
        }
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

server.get('/episodes/list/:sorting/:order', requiresAuth, function (req, res, next) {
    episode.findAll({
        include: [tvshow],
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
        include: [tvshow],
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
        episode = episode.toJSON();

        if (UserManager.hasSavedProgress(req.authorization.jwt.username, episode.tvdbid))
            episode.watchTime = UserManager.getSavedProgress(req.authorization.jwt.username, episode.tvdbid).time;

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
