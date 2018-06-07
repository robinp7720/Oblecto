module.exports = (sequelize, DataTypes) => {
    return sequelize.define('episodes', {
        tvdbid: { type: DataTypes.INTEGER, unique: true },
        showid: DataTypes.INTEGER,

        episodeName: DataTypes.STRING,

        absoluteNumber: DataTypes.INTEGER,
        airedEpisodeNumber: DataTypes.INTEGER,
        airedSeason: DataTypes.INTEGER,
        airedSeasonID: DataTypes.INTEGER,
        dvdEpisodeNumber: DataTypes.DOUBLE,
        dvdSeason: DataTypes.INTEGER,

        firstAired: DataTypes.DATEONLY,
        overview: DataTypes.TEXT,
    });
};