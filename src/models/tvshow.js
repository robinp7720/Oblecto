module.exports = (sequelize, DataTypes) => {
    return sequelize.define('tvshow', {
        tvdbid: { type: DataTypes.INTEGER, unique: true },
        imdbid: { type: DataTypes.STRING(64) },
        seriesId: { type: DataTypes.INTEGER },
        zap2itId: { type: DataTypes.STRING(64)},
        tmdbid: { type: DataTypes.INTEGER},

        seriesName: DataTypes.STRING,
        alias: DataTypes.STRING,
        genre: DataTypes.STRING,
        status: DataTypes.STRING,
        firstAired: DataTypes.DATEONLY,
        network: DataTypes.STRING,
        runtime: DataTypes.INTEGER,
        overview: DataTypes.TEXT,
        airsDayOfWeek: DataTypes.STRING,
        airsTime: DataTypes.STRING,
        rating: DataTypes.STRING,
        popularity: DataTypes.FLOAT,

        siteRating: DataTypes.DOUBLE,
        siteRatingCount: DataTypes.INTEGER,

        directory: DataTypes.STRING
    });
};