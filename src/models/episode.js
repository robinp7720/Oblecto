module.exports = (sequelize, DataTypes) => {
    return sequelize.define('episodes', {
        tvdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },
        tmdbid: { type: DataTypes.INTEGER, allowNull: true, unique: true },
        imdbid: { type: DataTypes.STRING, allowNull: true, unique: true },

        episodeName: DataTypes.STRING,

        absoluteNumber: DataTypes.INTEGER,
        airedEpisodeNumber: DataTypes.INTEGER,
        airedSeason: DataTypes.INTEGER,
        dvdEpisodeNumber: DataTypes.DOUBLE,
        dvdSeason: DataTypes.INTEGER,

        firstAired: DataTypes.DATEONLY,
        overview: DataTypes.TEXT,
    });
};
